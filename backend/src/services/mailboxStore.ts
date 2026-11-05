import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { emptyMailbox, type MailboxDoc } from "./mailboxLogic";

const BUCKET = process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments";

function pathFor(organizationId: string, userId: string): string {
  return `${organizationId}/mailbox/${userId}.json`;
}

export async function loadMailbox(organizationId: string, userId: string): Promise<MailboxDoc> {
  const { data, error } = await supabase.storage.from(BUCKET).download(pathFor(organizationId, userId));
  if (error || !data) return emptyMailbox();
  try {
    const parsed = JSON.parse(await data.text()) as Partial<MailboxDoc>;
    return {
      ...emptyMailbox(),
      ...parsed,
      autoReply: { ...emptyMailbox().autoReply, ...(parsed.autoReply ?? {}) },
      emails: parsed.emails ?? {},
      autoReplied: parsed.autoReplied ?? {},
      signature: parsed.signature ?? [],
      aliases: parsed.aliases ?? [],
      lists: parsed.lists ?? [],
      rules: parsed.rules ?? [],
      shares: parsed.shares ?? [],
      access: parsed.access ?? [],
    };
  } catch {
    return emptyMailbox();
  }
}

export async function saveMailbox(
  organizationId: string,
  userId: string,
  doc: MailboxDoc
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(
    pathFor(organizationId, userId),
    Buffer.from(JSON.stringify(doc)),
    { contentType: "application/json", upsert: true }
  );
  if (error) throw new ApiError(500, error.message);
}

export async function mutateMailbox(
  organizationId: string,
  userId: string,
  change: (doc: MailboxDoc) => void
): Promise<MailboxDoc> {
  const doc = await loadMailbox(organizationId, userId);
  change(doc);
  await saveMailbox(organizationId, userId, doc);
  return doc;
}
