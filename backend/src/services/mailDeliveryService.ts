import nodemailer from "nodemailer";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { getIo } from "../realtime/socket";
import { decryptEmailContent, createEmail } from "./emailProcessor";
import { loadMailbox, mutateMailbox } from "./mailboxStore";
import {
  applyRules,
  factsFromText,
  scheduleDecision,
  withSignature,
  type Address,
  type EmailMeta,
} from "./mailboxLogic";
import { trackEvent } from "./analyticsService";

interface OrgUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

interface EmailRow {
  id: string;
  senderId: string;
  recipients: Address[];
  subject: string;
  content: string;
  bulletPoints: string[] | null;
  attachments: { name: string }[] | null;
  status: string;
  threadId: string | null;
  sentAt: string | null;
}

function smtpFrom(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "";
}

function transporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const privateKey = process.env.DKIM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const dkim =
    privateKey && process.env.DKIM_DOMAIN && process.env.DKIM_SELECTOR
      ? {
          domainName: process.env.DKIM_DOMAIN,
          keySelector: process.env.DKIM_SELECTOR,
          privateKey,
        }
      : undefined;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    dkim,
  });
}

export function mailAuthStatus() {
  return {
    smtp: Boolean(process.env.SMTP_HOST && smtpFrom()),
    dkim: Boolean(process.env.DKIM_PRIVATE_KEY && process.env.DKIM_DOMAIN && process.env.DKIM_SELECTOR),
    spf: "Publish a TXT record on the sending domain that authorizes SMTP_HOST.",
    dmarc: "Publish a TXT record at _dmarc on the sending domain (v=DMARC1).",
  };
}

async function orgUsers(organizationId: string): Promise<OrgUser[]> {
  const { data, error } = await supabase
    .from("User")
    .select("id, email, name, organizationId")
    .eq("organizationId", organizationId);
  if (error) throw error;
  return (data ?? []) as OrgUser[];
}

async function userById(userId: string): Promise<OrgUser | null> {
  const { data, error } = await supabase
    .from("User")
    .select("id, email, name, organizationId")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as OrgUser | null) ?? null;
}

function visibleAddresses(recipients: Address[]): Address[] {
  return recipients.filter((recipient) => (recipient.role ?? "to") !== "bcc");
}

function messageBody(bullets: string[]): string {
  return bullets.filter(Boolean).map((bullet) => `• ${bullet}`).join("\n");
}

export async function queueSend(emailId: string, senderId: string, sendAt?: string): Promise<EmailRow> {
  const decision = scheduleDecision(Date.now(), sendAt);
  const { data, error } = await supabase
    .from("Email")
    .update({ status: decision.status, sentAt: decision.at })
    .eq("id", emailId)
    .eq("senderId", senderId)
    .in("status", ["draft", "pending", "scheduled"])
    .select("*")
    .single();
  if (error || !data) throw new ApiError(404, "Email not found");

  const sender = await userById(senderId);
  if (sender) {
    await mutateMailbox(sender.organizationId, senderId, (doc) => {
      const current = doc.emails[emailId] ?? {};
      doc.emails[emailId] = {
        ...current,
        undoUntil: decision.status === "pending" ? decision.at : null,
        scheduledFor: decision.status === "scheduled" ? decision.at : null,
        deliveryStatus: "pending",
        direction: current.direction ?? "out",
      };
    });
  }
  return data as EmailRow;
}

export async function deliverEmail(emailId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("Email")
    .update({ status: "sending" })
    .eq("id", emailId)
    .in("status", ["pending", "scheduled"])
    .lte("sentAt", now)
    .select("*")
    .maybeSingle();
  if (error || !data) return;

  const row = decryptEmailContent(data as EmailRow & { content: string });
  const sender = await userById(row.senderId);
  if (!sender) {
    await supabase.from("Email").update({ status: "sent", sentAt: now }).eq("id", emailId);
    return;
  }

  const mailbox = await loadMailbox(sender.organizationId, sender.id);
  const meta = mailbox.emails[emailId] ?? {};
  const bullets = withSignature(row.bulletPoints ?? factsFromText(row.content), mailbox.signature);
  const people = await orgUsers(sender.organizationId);
  const byEmail = new Map(people.map((person) => [person.email.trim().toLowerCase(), person]));
  const recipients = visibleAddresses(row.recipients ?? []);
  const bcc = meta.bcc ?? [];
  const everyone = [...recipients, ...bcc];
  const external = everyone.filter((address) => address.email && !byEmail.has(address.email.trim().toLowerCase()));

  let deliveryStatus: EmailMeta["deliveryStatus"] = external.length === 0 ? "internal" : "not_configured";
  let bounceReason: string | null = null;
  const transport = transporter();
  if (external.length > 0 && transport && smtpFrom()) {
    try {
      const domain = smtpFrom().split("@")[1] || "localhost";
      const toList = recipients.filter((address) => (address.role ?? "to") !== "cc");
      const ccList = recipients.filter((address) => address.role === "cc");
      await transport.sendMail({
        from: smtpFrom(),
        to: toList.map((address) => address.email).filter(Boolean) as string[],
        cc: ccList.map((address) => address.email).filter(Boolean) as string[],
        bcc: bcc.map((address) => address.email).filter(Boolean) as string[],
        replyTo: meta.alias || undefined,
        subject: row.subject,
        text: messageBody(bullets),
        messageId: `<${row.id}@${domain}>`,
      });
      deliveryStatus = "sent";
    } catch (err) {
      deliveryStatus = "failed";
      bounceReason = "The mail server rejected the message.";
      logger.error({ err, emailId }, "SMTP delivery failed");
    }
  } else if (external.length > 0 && !transport) {
    bounceReason = "SMTP is not configured, so this message stayed inside the organization.";
  }

  await supabase
    .from("Email")
    .update({ status: "sent", sentAt: now, bulletPoints: bullets })
    .eq("id", emailId);

  await mutateMailbox(sender.organizationId, sender.id, (doc) => {
    doc.emails[emailId] = {
      ...(doc.emails[emailId] ?? {}),
      folder: "sent",
      unread: false,
      direction: "out",
      deliveryStatus,
      bounceReason,
      undoUntil: null,
    };
  });

  for (const address of everyone) {
    const person = address.email ? byEmail.get(address.email.trim().toLowerCase()) : undefined;
    if (!person || person.id === sender.id) continue;
    const rulePatch = applyRules( (await loadMailbox(person.organizationId, person.id)).rules, {
      from: `${sender.name} ${sender.email}`,
      subject: row.subject,
      hasAttachment: Boolean(row.attachments && row.attachments.length > 0),
    });
    await mutateMailbox(person.organizationId, person.id, (doc) => {
      doc.emails[emailId] = {
        ...(doc.emails[emailId] ?? {}),
        ...rulePatch,
        folder: rulePatch.folder ?? "inbox",
        unread: true,
        direction: "in",
        from: { name: sender.name, email: sender.email },
      };
    });
    getIo()?.to(`user:${person.id}`).emit("email:received", { id: emailId, subject: row.subject });
    await maybeAutoReply(person, sender, row);
  }

  await trackEvent(sender.id, "email_sent");
}

async function maybeAutoReply(recipient: OrgUser, sender: OrgUser, row: EmailRow): Promise<void> {
  if (row.subject.startsWith("Auto:")) return;
  const doc = await loadMailbox(recipient.organizationId, recipient.id);
  if (!doc.autoReply.enabled || doc.autoReply.facts.length === 0) return;
  if (doc.autoReply.until && Date.parse(doc.autoReply.until) < Date.now()) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = sender.email.trim().toLowerCase();
  if (doc.autoReplied[key] === day) return;

  const reply = await createEmail({
    senderId: recipient.id,
    recipients: [{ name: sender.name, email: sender.email }],
    subject: `Auto: ${row.subject}`.slice(0, 200),
    content: doc.autoReply.facts.join("\n"),
    bulletPoints: doc.autoReply.facts,
    threadId: row.threadId,
    status: "pending",
    sentAt: new Date().toISOString(),
  });
  await mutateMailbox(recipient.organizationId, recipient.id, (current) => {
    current.autoReplied[key] = day;
    current.emails[reply.id] = { ...(current.emails[reply.id] ?? {}), auto: true, direction: "out" };
  });
  await deliverEmail(reply.id);
}

export function startMailboxSweeper(intervalMs = 5000): void {
  setInterval(() => {
    void sweep().catch((err) => logger.error({ err }, "mailbox sweeper failed"));
  }, intervalMs);
}

async function sweep(): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("Email")
    .select("id")
    .in("status", ["pending", "scheduled"])
    .lte("sentAt", now)
    .limit(20);
  if (error || !data) return;
  for (const row of data) {
    await deliverEmail(row.id);
  }
}

export async function recordBounce(emailId: string, reason: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("Email")
    .select("id, senderId")
    .eq("id", emailId)
    .maybeSingle();
  if (error || !data) return false;
  const sender = await userById(data.senderId);
  if (!sender) return false;
  await mutateMailbox(sender.organizationId, sender.id, (doc) => {
    doc.emails[emailId] = {
      ...(doc.emails[emailId] ?? {}),
      deliveryStatus: "bounced",
      bounceReason: reason.slice(0, 300),
    };
  });
  return true;
}
