import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { emptyMailbox, parseSearch, type EmailMeta, type MailboxDoc, type MailFolder } from "./mailboxLogic";

const BUCKET = process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments";

function pathFor(organizationId: string, userId: string): string {
  return `${organizationId}/mailbox/${userId}.json`;
}

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /does not exist|schema cache|Could not find|PGRST202|PGRST205|42883|42P01/i.test(message);
}

function docFromParts(
  profile: Partial<MailboxDoc> | null,
  rows: Array<{ emailId: string; meta: EmailMeta | null }>
): MailboxDoc {
  const base = emptyMailbox();
  const doc: MailboxDoc = {
    ...base,
    ...profile,
    autoReply: { ...base.autoReply, ...(profile?.autoReply ?? {}) },
    emails: {},
    autoReplied: profile?.autoReplied ?? {},
    signature: profile?.signature ?? [],
    aliases: profile?.aliases ?? [],
    lists: profile?.lists ?? [],
    rules: profile?.rules ?? [],
    shares: profile?.shares ?? [],
    access: profile?.access ?? [],
  };
  for (const row of rows) {
    if (row.meta) doc.emails[row.emailId] = row.meta;
  }
  return doc;
}

async function loadJson(organizationId: string, userId: string): Promise<MailboxDoc> {
  const { data, error } = await supabase.storage.from(BUCKET).download(pathFor(organizationId, userId));
  if (error || !data) return emptyMailbox();
  try {
    const parsed = JSON.parse(await data.text()) as Partial<MailboxDoc>;
    return docFromParts(parsed, Object.entries(parsed.emails ?? {}).map(([emailId, meta]) => ({ emailId, meta })));
  } catch {
    return emptyMailbox();
  }
}

async function saveJson(organizationId: string, userId: string, doc: MailboxDoc): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(
    pathFor(organizationId, userId),
    Buffer.from(JSON.stringify(doc)),
    { contentType: "application/json", upsert: true }
  );
  if (error) throw new ApiError(500, error.message);
}

function profilePayload(organizationId: string, userId: string, doc: MailboxDoc) {
  return {
    userId,
    organizationId,
    signature: doc.signature,
    aliases: doc.aliases,
    lists: doc.lists,
    autoReply: doc.autoReply,
    rules: doc.rules,
    shares: doc.shares,
    access: doc.access,
    autoReplied: doc.autoReplied,
  };
}

function profileChanged(before: MailboxDoc, after: MailboxDoc): boolean {
  const fields: Array<keyof MailboxDoc> = [
    "signature",
    "aliases",
    "lists",
    "autoReply",
    "rules",
    "shares",
    "access",
    "autoReplied",
  ];
  return fields.some((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

async function loadFromTables(organizationId: string, userId: string): Promise<MailboxDoc | null> {
  const profile = await supabase.from("MailboxProfile").select("*").eq("userId", userId).maybeSingle();
  if (profile.error) {
    if (missingRelation(profile.error)) return null;
    throw new ApiError(500, profile.error.message);
  }
  const emails = await supabase.from("MailboxEmail").select("emailId, meta").eq("userId", userId).eq("organizationId", organizationId);
  if (emails.error) {
    if (missingRelation(emails.error)) return null;
    throw new ApiError(500, emails.error.message);
  }
  const rows = (emails.data ?? []) as Array<{ emailId: string; meta: EmailMeta | null }>;
  if (!profile.data && rows.length === 0) {
    const legacy = await loadJson(organizationId, userId);
    const hasLegacy =
      Object.keys(legacy.emails).length > 0 ||
      legacy.rules.length > 0 ||
      legacy.aliases.length > 0 ||
      legacy.signature.length > 0 ||
      legacy.lists.length > 0 ||
      legacy.shares.length > 0 ||
      legacy.access.length > 0;
    if (hasLegacy) {
      await persistTables(organizationId, userId, emptyMailbox(), legacy);
      return legacy;
    }
  }
  return docFromParts(profile.data as Partial<MailboxDoc> | null, rows);
}

async function persistTables(
  organizationId: string,
  userId: string,
  before: MailboxDoc,
  after: MailboxDoc
): Promise<boolean> {
  if (profileChanged(before, after)) {
    const saved = await supabase.from("MailboxProfile").upsert(profilePayload(organizationId, userId, after), { onConflict: "userId" });
    if (saved.error) {
      if (missingRelation(saved.error)) return false;
      throw new ApiError(500, saved.error.message);
    }
  }
  for (const [emailId, meta] of Object.entries(after.emails)) {
    if (JSON.stringify(before.emails[emailId]) === JSON.stringify(meta)) continue;
    const saved = await supabase.from("MailboxEmail").upsert(
      { userId, emailId, organizationId, meta },
      { onConflict: "userId,emailId" }
    );
    if (saved.error) {
      if (missingRelation(saved.error)) return false;
      throw new ApiError(500, saved.error.message);
    }
  }
  for (const emailId of Object.keys(before.emails)) {
    if (after.emails[emailId]) continue;
    const removed = await supabase.from("MailboxEmail").delete().eq("userId", userId).eq("emailId", emailId);
    if (removed.error) {
      if (missingRelation(removed.error)) return false;
      throw new ApiError(500, removed.error.message);
    }
  }
  return true;
}

async function persistMailbox(
  organizationId: string,
  userId: string,
  before: MailboxDoc,
  after: MailboxDoc
): Promise<void> {
  const stored = await persistTables(organizationId, userId, before, after);
  if (!stored) await saveJson(organizationId, userId, after);
}

export async function loadMailbox(organizationId: string, userId: string): Promise<MailboxDoc> {
  const doc = await loadFromTables(organizationId, userId);
  if (doc) return doc;
  return loadJson(organizationId, userId);
}

export async function saveMailbox(organizationId: string, userId: string, doc: MailboxDoc): Promise<void> {
  const current = await loadMailbox(organizationId, userId);
  await persistMailbox(organizationId, userId, current, doc);
}

export async function mutateMailbox(
  organizationId: string,
  userId: string,
  change: (doc: MailboxDoc) => void
): Promise<MailboxDoc> {
  const current = await loadMailbox(organizationId, userId);
  const next = structuredClone(current);
  change(next);
  await persistMailbox(organizationId, userId, current, next);
  return next;
}

export interface MailboxPage {
  ids: string[];
  metas: Record<string, EmailMeta>;
  total: number;
  unread: number;
}

function isoOrNull(value?: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export async function pageMailbox(options: {
  organizationId: string;
  userId: string;
  folder: MailFolder;
  query: string;
  filterType?: string;
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
}): Promise<MailboxPage | null> {
  if (typeof supabase.rpc !== "function") return null;
  const parsed = parseSearch(options.query);
  if (options.filterType === "subject" && options.query && !parsed.subject) parsed.subject = options.query.toLowerCase();
  if (options.filterType === "recipient" && options.query && !parsed.to) parsed.to = options.query.toLowerCase();
  const status = options.filterType === "status" ? options.query : "";
  const { data, error } = await supabase.rpc("page_mailbox", {
    p_user: options.userId,
    p_org: options.organizationId,
    p_folder: options.folder,
    p_limit: options.pageSize,
    p_offset: (options.page - 1) * options.pageSize,
    p_text: options.filterType === "status" ? "" : parsed.text,
    p_subject: parsed.subject ?? "",
    p_from: parsed.from ?? "",
    p_to: parsed.to ?? "",
    p_label: parsed.label ?? "",
    p_starred: parsed.starred === true,
    p_unread: parsed.unread === true,
    p_attachment: parsed.hasAttachment === true,
    p_before: isoOrNull(parsed.before ?? options.dateTo),
    p_after: isoOrNull(parsed.after ?? options.dateFrom),
    p_status: status,
    p_sort: options.sortBy ?? "",
  });
  if (error) {
    if (missingRelation(error)) return null;
    throw new ApiError(500, error.message);
  }
  const rows = (data ?? []) as Array<{ emailId: string; meta: EmailMeta; total: number | string }>;
  const unread = await supabase.rpc("unread_mailbox", {
    p_user: options.userId,
    p_org: options.organizationId,
  });
  const unreadCount = unread.error ? 0 : Number(unread.data ?? 0);
  const metas: Record<string, EmailMeta> = {};
  for (const row of rows) metas[row.emailId] = row.meta;
  return {
    ids: rows.map((row) => row.emailId),
    metas,
    total: rows.length > 0 ? Number(rows[0].total) : 0,
    unread: unreadCount,
  };
}
