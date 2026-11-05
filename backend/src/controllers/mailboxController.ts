import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { createEmail } from "../services/emailProcessor";
import { loadMailbox, mutateMailbox } from "../services/mailboxStore";
import { applyRules, factsFromText, type Address } from "../services/mailboxLogic";
import { mailAuthStatus, recordBounce } from "../services/mailDeliveryService";
import { orgUser } from "../services/mailboxService";
import { getIo } from "../realtime/socket";

const addressSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().nullable(),
});

const settingsSchema = z
  .object({
    signature: z.array(z.string().max(180)).max(8).optional(),
    aliases: z.array(addressSchema).max(10).optional(),
    lists: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          addresses: z.array(addressSchema).max(50),
        })
      )
      .max(20)
      .optional(),
    autoReply: z
      .object({
        enabled: z.boolean(),
        facts: z.array(z.string().max(180)).max(8),
        until: z.string().nullable(),
      })
      .optional(),
  })
  .strict();

const ruleSchema = z
  .object({
    from: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    hasAttachment: z.boolean().optional(),
    folder: z.enum(["inbox", "spam", "archive", "trash"]).optional(),
    label: z.string().min(1).max(40).optional(),
    star: z.boolean().optional(),
  })
  .strict();

function publicDoc(doc: Awaited<ReturnType<typeof loadMailbox>>) {
  return {
    signature: doc.signature,
    aliases: doc.aliases,
    lists: doc.lists,
    autoReply: doc.autoReply,
    rules: doc.rules,
    shares: doc.shares,
    access: doc.access,
    mailAuth: mailAuthStatus(),
  };
}

export async function getMailbox(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await loadMailbox(req.auth!.organizationId, req.auth!.userId);
    res.json(publicDoc(doc));
  } catch (err) {
    next(err);
  }
}

export async function updateMailbox(req: Request, res: Response, next: NextFunction) {
  try {
    const input = settingsSchema.parse(req.body);
    const doc = await mutateMailbox(req.auth!.organizationId, req.auth!.userId, (current) => {
      if (input.signature) current.signature = input.signature.map((fact) => fact.trim()).filter(Boolean);
      if (input.aliases) current.aliases = input.aliases;
      if (input.lists) current.lists = input.lists;
      if (input.autoReply) current.autoReply = input.autoReply;
    });
    res.json(publicDoc(doc));
  } catch (err) {
    next(err);
  }
}

export async function addShare(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z
      .object({ email: z.string().email(), role: z.enum(["read", "send"]) })
      .parse(req.body);
    const { data, error } = await supabase
      .from("User")
      .select("id, email, name, organizationId")
      .eq("email", input.email)
      .maybeSingle();
    if (error || !data || data.organizationId !== req.auth!.organizationId) {
      throw new ApiError(404, "That person is not in your organization");
    }
    if (data.id === req.auth!.userId) throw new ApiError(400, "You already have your own mailbox");

    const owner = await orgUser(req.auth!.userId);
    await mutateMailbox(req.auth!.organizationId, req.auth!.userId, (doc) => {
      doc.shares = doc.shares.filter((share) => share.userId !== data.id);
      doc.shares.push({ userId: data.id, role: input.role });
    });
    await mutateMailbox(req.auth!.organizationId, data.id, (doc) => {
      doc.access = doc.access.filter((share) => share.userId !== owner.id);
      doc.access.push({ userId: owner.id, role: input.role, name: owner.name, email: owner.email });
    });
    const doc = await loadMailbox(req.auth!.organizationId, req.auth!.userId);
    res.status(201).json(publicDoc(doc));
  } catch (err) {
    next(err);
  }
}

export async function removeShare(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId;
    await mutateMailbox(req.auth!.organizationId, req.auth!.userId, (doc) => {
      doc.shares = doc.shares.filter((share) => share.userId !== userId);
    });
    await mutateMailbox(req.auth!.organizationId, userId, (doc) => {
      doc.access = doc.access.filter((share) => share.userId !== req.auth!.userId);
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addRule(req: Request, res: Response, next: NextFunction) {
  try {
    const input = ruleSchema.parse(req.body);
    const doc = await mutateMailbox(req.auth!.organizationId, req.auth!.userId, (current) => {
      current.rules.push({ ...input, id: crypto.randomUUID() });
    });
    res.status(201).json(publicDoc(doc));
  } catch (err) {
    next(err);
  }
}

export async function removeRule(req: Request, res: Response, next: NextFunction) {
  try {
    await mutateMailbox(req.auth!.organizationId, req.auth!.userId, (doc) => {
      doc.rules = doc.rules.filter((rule) => rule.id !== req.params.ruleId);
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

function assertWebhook(req: Request) {
  const expected = process.env.MAIL_WEBHOOK_SECRET ?? "";
  const got = String(req.header("x-mail-webhook-secret") ?? "");
  if (expected.length < 16) throw new ApiError(503, "MAIL_WEBHOOK_SECRET is not set");
  const left = Buffer.from(got);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new ApiError(401, "Unauthorized");
  }
}

const inboundSchema = z.object({
  to: z.string().email(),
  from: z.union([
    z.string().email(),
    z.object({ name: z.string().max(100).optional(), email: z.string().email() }),
  ]),
  subject: z.string().min(1).max(200),
  text: z.string().max(20000).default(""),
});

export async function inboundMail(req: Request, res: Response, next: NextFunction) {
  try {
    assertWebhook(req);
    const input = inboundSchema.parse(req.body);
    const from =
      typeof input.from === "string"
        ? { name: input.from.split("@")[0], email: input.from }
        : { name: input.from.name?.trim() || input.from.email.split("@")[0], email: input.from.email };

    const { data: user, error } = await supabase
      .from("User")
      .select("id, email, name, organizationId")
      .eq("email", input.to)
      .maybeSingle();
    if (error || !user) throw new ApiError(404, "Recipient not found");

    const facts = factsFromText(input.text);
    const bullets = facts.length > 0 ? facts : [input.subject];
    const email = await createEmail({
      senderId: user.id,
      recipients: [{ name: user.name, email: user.email }],
      subject: input.subject,
      content: bullets.join("\n"),
      bulletPoints: bullets,
      status: "sent",
      sentAt: new Date().toISOString(),
    });

    const doc = await loadMailbox(user.organizationId, user.id);
    const rulePatch = applyRules(doc.rules, {
      from: `${from.name} ${from.email}`,
      subject: input.subject,
      hasAttachment: false,
    });
    await mutateMailbox(user.organizationId, user.id, (current) => {
      current.emails[email.id] = {
        ...rulePatch,
        folder: rulePatch.folder ?? "inbox",
        unread: true,
        direction: "in",
        from,
      };
    });
    getIo()?.to(`user:${user.id}`).emit("email:received", { id: email.id, subject: input.subject });
    res.status(201).json({ id: email.id });
  } catch (err) {
    next(err);
  }
}

export async function bounceMail(req: Request, res: Response, next: NextFunction) {
  try {
    assertWebhook(req);
    const input = z
      .object({ emailId: z.string().min(1).max(80), reason: z.string().min(1).max(300) })
      .parse(req.body);
    const saved = await recordBounce(input.emailId, input.reason);
    if (!saved) throw new ApiError(404, "Email not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export type { Address };
