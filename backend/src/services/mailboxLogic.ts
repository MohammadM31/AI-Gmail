export interface Address {
  name: string;
  email: string | null;
  role?: "to" | "cc" | "bcc";
}

export type MailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "spam"
  | "archive"
  | "trash"
  | "scheduled"
  | "starred";

export interface EmailMeta {
  folder?: "inbox" | "sent" | "drafts" | "spam" | "archive" | "trash";
  starred?: boolean;
  unread?: boolean;
  labels?: string[];
  cc?: Address[];
  bcc?: Address[];
  scheduledFor?: string | null;
  undoUntil?: string | null;
  deliveryStatus?:
    | "pending"
    | "sent"
    | "delivered"
    | "bounced"
    | "failed"
    | "internal"
    | "not_configured";
  bounceReason?: string | null;
  direction?: "in" | "out";
  from?: Address | null;
  quoted?: string[];
  alias?: string | null;
  auto?: boolean;
}

export interface MailRule {
  id: string;
  from?: string;
  subject?: string;
  hasAttachment?: boolean;
  folder?: "inbox" | "spam" | "archive" | "trash";
  label?: string;
  star?: boolean;
}

export interface MailboxDoc {
  signature: string[];
  aliases: Address[];
  lists: { name: string; addresses: Address[] }[];
  autoReply: { enabled: boolean; facts: string[]; until: string | null };
  rules: MailRule[];
  shares: { userId: string; role: "read" | "send" }[];
  access: { userId: string; role: "read" | "send"; name: string; email: string }[];
  emails: Record<string, EmailMeta>;
  autoReplied: Record<string, string>;
}

export interface MailRow {
  id: string;
  senderId: string;
  status: string;
  deletedAt?: string | null;
  recipients: Address[];
  subject: string;
  bulletPoints?: string[];
  attachments?: unknown[] | null;
  createdAt: string;
}

export function emptyMailbox(): MailboxDoc {
  return {
    signature: [],
    aliases: [],
    lists: [],
    autoReply: { enabled: false, facts: [], until: null },
    rules: [],
    shares: [],
    access: [],
    emails: {},
    autoReplied: {},
  };
}

export function addressEmail(value: Address | null | undefined): string {
  return (value?.email ?? "").trim().toLowerCase();
}

export function involvesAddress(recipients: Address[], email: string): boolean {
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return recipients.some((recipient) => {
    if (addressEmail(recipient) !== target) return false;
    return (recipient.role ?? "to") !== "bcc";
  });
}

export function inFolder(
  row: MailRow,
  viewerEmail: string,
  viewerId: string,
  meta: EmailMeta | undefined,
  folder: MailFolder
): boolean {
  const deleted = Boolean(row.deletedAt);
  const mine = row.senderId === viewerId;
  const inbound =
    meta?.direction === "in" ||
    (!mine && involvesAddress(row.recipients ?? [], viewerEmail));
  const placed = meta?.folder;

  if (folder === "trash") {
    return (mine && deleted) || placed === "trash";
  }
  if (deleted || placed === "trash") return false;
  if (folder === "starred") return Boolean(meta?.starred);
  if (folder === "spam") return placed === "spam";
  if (folder === "archive") return placed === "archive";
  if (placed === "spam" || placed === "archive") return false;
  if (folder === "drafts") return mine && row.status === "draft";
  if (folder === "scheduled") {
    return mine && (row.status === "pending" || row.status === "scheduled");
  }
  if (folder === "sent") {
    return mine && (row.status === "sent" || row.status === "sending") && meta?.direction !== "in";
  }
  if (meta?.direction === "in") return row.status === "sent";
  return inbound && row.status === "sent";
}

export function isUnread(meta: EmailMeta | undefined, inbound: boolean): boolean {
  if (typeof meta?.unread === "boolean") return meta.unread;
  return inbound;
}

export interface ParsedSearch {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  starred?: boolean;
  unread?: boolean;
  label?: string;
  before?: string;
  after?: string;
  text: string;
}

const SEARCH_OP =
  /(from|to|subject|label|before|after|is|has):(?:"([^"]+)"|(\S+))/gi;

export function parseSearch(query: string): ParsedSearch {
  const parsed: ParsedSearch = { text: "" };
  const re = new RegExp(SEARCH_OP.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(query))) {
    const key = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? "").trim();
    if (key === "from") parsed.from = value.toLowerCase();
    else if (key === "to") parsed.to = value.toLowerCase();
    else if (key === "subject") parsed.subject = value.toLowerCase();
    else if (key === "label") parsed.label = value.toLowerCase();
    else if (key === "before") parsed.before = value;
    else if (key === "after") parsed.after = value;
    else if (key === "has" && value.toLowerCase() === "attachment") parsed.hasAttachment = true;
    else if (key === "is" && value.toLowerCase() === "starred") parsed.starred = true;
    else if (key === "is" && value.toLowerCase() === "unread") parsed.unread = true;
  }
  parsed.text = query
    .replace(new RegExp(SEARCH_OP.source, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return parsed;
}

export function matchesSearch(
  row: MailRow,
  meta: EmailMeta | undefined,
  parsed: ParsedSearch,
  inbound: boolean
): boolean {
  const from = `${meta?.from?.name ?? ""} ${meta?.from?.email ?? ""}`.toLowerCase();
  const to = (row.recipients ?? [])
    .map((recipient) => `${recipient.name} ${recipient.email ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (parsed.from && !from.includes(parsed.from)) return false;
  if (parsed.to && !to.includes(parsed.to)) return false;
  if (parsed.subject && !row.subject.toLowerCase().includes(parsed.subject)) return false;
  if (parsed.hasAttachment && !(row.attachments && row.attachments.length > 0)) return false;
  if (parsed.starred && !meta?.starred) return false;
  if (parsed.unread && !isUnread(meta, inbound)) return false;
  if (parsed.label) {
    const labels = (meta?.labels ?? []).map((label) => label.toLowerCase());
    if (!labels.includes(parsed.label)) return false;
  }
  const created = Date.parse(row.createdAt);
  if (parsed.before && !Number.isNaN(created) && created > Date.parse(parsed.before)) return false;
  if (parsed.after && !Number.isNaN(created) && created < Date.parse(parsed.after)) return false;
  if (!parsed.text) return true;
  const haystack = `${row.subject} ${(row.bulletPoints ?? []).join(" ")}`.toLowerCase();
  return haystack.includes(parsed.text);
}

export function applyRules(
  rules: MailRule[],
  input: { from: string; subject: string; hasAttachment: boolean }
): Partial<EmailMeta> {
  const patch: Partial<EmailMeta> = {};
  for (const rule of rules) {
    if (rule.from && !input.from.toLowerCase().includes(rule.from.toLowerCase())) continue;
    if (rule.subject && !input.subject.toLowerCase().includes(rule.subject.toLowerCase())) continue;
    if (rule.hasAttachment && !input.hasAttachment) continue;
    if (rule.folder) patch.folder = rule.folder;
    if (rule.label) patch.labels = [...(patch.labels ?? []), rule.label];
    if (rule.star) patch.starred = true;
  }
  return patch;
}

export function quotedBullets(subject: string, bullets: string[], limit: number): string[] {
  return bullets
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((bullet) => `Earlier (${subject}): ${bullet}`.slice(0, 180));
}

export function withSignature(bullets: string[], signature: string[]): string[] {
  const extra = signature
    .map((fact) => fact.trim())
    .filter(Boolean)
    .filter((fact) => !bullets.includes(fact));
  return [...bullets, ...extra];
}

export function factsFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/(?<=[.!?])\s+/);
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.slice(0, 180))
    .slice(0, 8);
}

export function scheduleDecision(
  now: number,
  sendAt: string | undefined,
  undoMs = 10_000
): { status: "pending" | "scheduled"; at: string } {
  const requested = sendAt ? Date.parse(sendAt) : Number.NaN;
  if (!Number.isNaN(requested) && requested > now + undoMs) {
    return { status: "scheduled", at: new Date(requested).toISOString() };
  }
  return { status: "pending", at: new Date(now + undoMs).toISOString() };
}
