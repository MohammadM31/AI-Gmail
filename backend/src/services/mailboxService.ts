import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { decryptEmailContent } from "./emailProcessor";
import { loadMailbox, mutateMailbox } from "./mailboxStore";
import {
  inFolder,
  involvesAddress,
  isUnread,
  matchesSearch,
  parseSearch,
  type Address,
  type EmailMeta,
  type MailFolder,
  type MailRow,
} from "./mailboxLogic";

interface OrgUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export async function orgUser(userId: string): Promise<OrgUser> {
  const { data, error } = await supabase
    .from("User")
    .select("id, email, name, organizationId")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new ApiError(404, "User not found");
  return data as OrgUser;
}

export async function assertMailboxRole(
  organizationId: string,
  actorId: string,
  ownerId: string,
  role: "read" | "send"
): Promise<OrgUser> {
  const owner = await orgUser(ownerId);
  if (owner.organizationId !== organizationId) throw new ApiError(404, "Email not found");
  if (actorId === ownerId) return owner;
  const actor = await loadMailbox(organizationId, actorId);
  const grant = actor.access.find((item) => item.userId === ownerId);
  if (!grant) throw new ApiError(403, "That mailbox is not shared with you");
  if (role === "send" && grant.role !== "send") {
    throw new ApiError(403, "You can read this mailbox but not send from it");
  }
  return owner;
}

export async function rememberAddresses(userId: string, addresses: Address[]): Promise<void> {
  for (const address of addresses) {
    const email = address.email?.trim();
    if (!email) continue;
    const { data } = await supabase
      .from("Contact")
      .select("id")
      .eq("userId", userId)
      .eq("email", email)
      .maybeSingle();
    if (data) continue;
    await supabase.from("Contact").insert({
      userId,
      name: address.name.trim() || email,
      email,
    });
  }
}

interface ListOptions {
  organizationId: string;
  actorId: string;
  ownerId: string;
  folder: MailFolder;
  query: string;
  filterType?: string;
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
}

export async function listMailbox(options: ListOptions) {
  const owner = await assertMailboxRole(options.organizationId, options.actorId, options.ownerId, "read");
  const { data: people, error: peopleError } = await supabase
    .from("User")
    .select("id")
    .eq("organizationId", options.organizationId);
  if (peopleError) throw new ApiError(500, peopleError.message);
  const ids = (people ?? []).map((person) => person.id);
  if (ids.length === 0) return { items: [], total: 0, unread: 0 };

  let query = supabase.from("Email").select("*").in("senderId", ids).order("createdAt", { ascending: false }).limit(300);
  if (options.folder === "trash") {
    query = supabase
      .from("Email")
      .select("*")
      .in("senderId", ids)
      .order("createdAt", { ascending: false })
      .limit(300);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);

  const doc = await loadMailbox(options.organizationId, owner.id);
  const parsed = parseSearch(options.query);
  if (options.filterType === "subject" && options.query && !parsed.subject) parsed.subject = options.query.toLowerCase();
  if (options.filterType === "recipient" && options.query && !parsed.to) parsed.to = options.query.toLowerCase();
    if (options.filterType === "status" && options.query) parsed.text = "";

  const rows = (data ?? []) as Array<MailRow & { content: string; chartData: unknown; threadId: string | null; sentAt: string | null; readReceipts: unknown; bulletPoints: string[] }>;
  const visible = rows.filter((row) => {
    const meta = doc.emails[row.id];
    if (!inFolder(row, owner.email, owner.id, meta, options.folder)) return false;
    if (options.dateFrom && Date.parse(row.createdAt) < Date.parse(options.dateFrom)) return false;
    if (options.dateTo) {
      const end = new Date(options.dateTo);
      end.setHours(23, 59, 59, 999);
      if (Date.parse(row.createdAt) > end.getTime()) return false;
    }
    const inbound = meta?.direction === "in" || (row.senderId !== owner.id && involvesAddress(row.recipients ?? [], owner.email));
    if (options.filterType === "status" && options.query && row.status !== options.query) return false;
    return matchesSearch(row, meta, parsed, inbound);
  });

  visible.sort((left, right) => compareRows(left, right, options.sortBy));
  const unread = rows.filter((row) => {
    const meta = doc.emails[row.id];
    const inbound = meta?.direction === "in" || (row.senderId !== owner.id && involvesAddress(row.recipients ?? [], owner.email));
    return inFolder(row, owner.email, owner.id, meta, "inbox") && isUnread(meta, inbound);
  }).length;

  const start = (options.page - 1) * options.pageSize;
  const page = visible.slice(start, start + options.pageSize);
  return {
    items: page.map((row) => presentEmail(row, owner.id, owner.email, doc.emails[row.id])),
    total: visible.length,
    unread,
  };
}

function compareRows(left: MailRow, right: MailRow, sortBy?: string): number {
  if (sortBy === "oldest") return left.createdAt.localeCompare(right.createdAt);
  if (sortBy === "subject-asc") return left.subject.localeCompare(right.subject);
  if (sortBy === "subject-desc") return right.subject.localeCompare(left.subject);
  if (sortBy === "status") return left.status.localeCompare(right.status);
  return right.createdAt.localeCompare(left.createdAt);
}

export function presentEmail<T extends MailRow & { content: string }>(
  row: T,
  viewerId: string,
  viewerEmail: string,
  meta: EmailMeta | undefined
) {
  const decrypted = decryptEmailContent(row);
  const mine = row.senderId === viewerId;
  const inbound =
    meta?.direction === "in" || (!mine && involvesAddress(row.recipients ?? [], viewerEmail));
  const recipients = (row.recipients ?? []).filter((recipient) => (recipient.role ?? "to") !== "bcc");
  return {
    ...decrypted,
    recipients,
    from: meta?.from ?? null,
    starred: Boolean(meta?.starred),
    unread: isUnread(meta, inbound),
    labels: meta?.labels ?? [],
    folder: meta?.folder ?? null,
    cc: meta?.cc ?? recipients.filter((recipient) => recipient.role === "cc"),
    bcc: mine ? meta?.bcc ?? [] : [],
    quoted: meta?.quoted ?? [],
    deliveryStatus: mine ? meta?.deliveryStatus ?? null : null,
    bounceReason: mine ? meta?.bounceReason ?? null : null,
    undoUntil: mine ? meta?.undoUntil ?? null : null,
    alias: meta?.alias ?? null,
  };
}

export async function readableEmail(organizationId: string, actorId: string, emailId: string) {
  const { data, error } = await supabase.from("Email").select("*").eq("id", emailId).maybeSingle();
  if (error || !data) throw new ApiError(404, "Email not found");
  const sender = await orgUser(data.senderId as string);
  if (sender.organizationId !== organizationId) throw new ApiError(404, "Email not found");

  const actor = await orgUser(actorId);
  const senderDoc = await loadMailbox(organizationId, sender.id);
  const actorDoc = actorId === sender.id ? senderDoc : await loadMailbox(organizationId, actorId);
  const meta = actorDoc.emails[emailId] ?? (actorId === sender.id ? senderDoc.emails[emailId] : undefined);
  const addressed = involvesAddress((data.recipients ?? []) as Address[], actor.email);
  const shared = actorDoc.access.some((item) => item.userId === sender.id);
  const inboundCopy = meta?.direction === "in";
  if (actorId !== sender.id && !addressed && !shared && !inboundCopy) {
    throw new ApiError(404, "Email not found");
  }
  return {
    row: data as MailRow & { content: string; threadId: string | null; senderId: string },
    sender,
    actor,
    meta: actorId === sender.id ? senderDoc.emails[emailId] : meta,
    senderMeta: senderDoc.emails[emailId],
  };
}

export async function setFlags(
  organizationId: string,
  actorId: string,
  emailId: string,
  flags: { starred?: boolean; unread?: boolean; folder?: EmailMeta["folder"]; labels?: string[] }
) {
  const found = await readableEmail(organizationId, actorId, emailId);
  let ownerId = actorId;
  if (actorId !== found.row.senderId) {
    const access = (await loadMailbox(organizationId, actorId)).access;
    if (access.some((item) => item.userId === found.row.senderId)) ownerId = found.row.senderId;
  }
  await mutateMailbox(organizationId, ownerId, (doc) => {
    const current = doc.emails[emailId] ?? {};
    doc.emails[emailId] = {
      ...current,
      ...(flags.starred === undefined ? {} : { starred: flags.starred }),
      ...(flags.unread === undefined ? {} : { unread: flags.unread }),
      ...(flags.folder === undefined ? {} : { folder: flags.folder }),
      ...(flags.labels === undefined ? {} : { labels: flags.labels }),
    };
  });
  if (found.row.senderId === actorId && flags.folder === "trash") {
    await supabase.from("Email").update({ deletedAt: new Date().toISOString() }).eq("id", emailId).eq("senderId", actorId);
  }
  if (found.row.senderId === actorId && flags.folder && flags.folder !== "trash") {
    await supabase.from("Email").update({ deletedAt: null }).eq("id", emailId).eq("senderId", actorId);
  }
  const doc = await loadMailbox(organizationId, ownerId);
  const viewer = ownerId === found.sender.id ? found.sender : found.actor;
  return presentEmail(found.row, viewer.id, viewer.email, doc.emails[emailId]);
}
