import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { getIo } from "../realtime/socket";
import { decryptEmailContent, createEmail } from "./emailProcessor";
import { loadMailbox, mutateMailbox } from "./mailboxStore";
import { rejectedAddress, rejectionMessage } from "./companyMail";
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

export async function assertCompanyRecipients(
  organizationId: string,
  addresses: Array<string | null | undefined>
): Promise<void> {
  if (addresses.length === 0) return;
  const offDomain = rejectedAddress(addresses);
  if (offDomain) throw new ApiError(400, rejectionMessage(offDomain));
  const unknown = rejectedAddress(addresses, await orgUsers(organizationId));
  if (unknown) throw new ApiError(400, rejectionMessage(unknown));
}

export async function queueSend(emailId: string, senderId: string, sendAt?: string): Promise<EmailRow> {
  const sender = await userById(senderId);
  if (!sender) throw new ApiError(404, "Email not found");
  const { data: draft, error: draftError } = await supabase
    .from("Email")
    .select("recipients")
    .eq("id", emailId)
    .eq("senderId", senderId)
    .maybeSingle();
  if (draftError || !draft) throw new ApiError(404, "Email not found");
  const queuedMeta = (await loadMailbox(sender.organizationId, senderId)).emails[emailId];
  const addressed = [...((draft.recipients ?? []) as Address[]), ...(queuedMeta?.bcc ?? [])];
  await assertCompanyRecipients(sender.organizationId, addressed.map((address) => address.email));

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

  // Mail never leaves the organization. A recipient who vanished since queueing bounces.
  const deliveryStatus: EmailMeta["deliveryStatus"] = external.length === 0 ? "internal" : "bounced";
  const bounceReason: string | null =
    external.length === 0 ? null : "A recipient is no longer an account in this organization.";

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

  const notified = new Set<string>();
  for (const address of everyone) {
    const person = address.email ? byEmail.get(address.email.trim().toLowerCase()) : undefined;
    if (!person || person.id === sender.id || notified.has(person.id)) continue;
    notified.add(person.id);
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
