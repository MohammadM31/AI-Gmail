// backend/src/services/emailProcessor.ts
import { randomUUID } from "crypto";
import { supabase } from "../utils/supabaseClient";
import { encrypt, decrypt } from "../utils/encryption";

export interface EmailAttachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface CreateEmailInput {
  senderId: string;
  recipients: { name: string; email: string | null }[];
  subject: string;
  content: string;
  bulletPoints: string[];
  chartData?: unknown;
  threadId?: string | null;
  attachments?: EmailAttachment[];
  status?: "draft" | "sent";
  sentAt?: string;
}

/**
 * Insert a new email, encrypting content at rest.
 * This is the ONLY safe way to insert into the Email table.
 */
export async function createEmail(input: CreateEmailInput) {
  const id = randomUUID();
  const threadId = input.threadId ?? id;

  const { data, error } = await supabase
    .from("Email")
    .insert({
      id,
      senderId: input.senderId,
      recipients: input.recipients,
      subject: input.subject,
      content: encrypt(input.content),
      bulletPoints: input.bulletPoints,
      chartData: input.chartData ?? null,
      attachments: input.attachments ?? [],
      status: input.status ?? "draft",
      sentAt: input.sentAt ?? null,
      threadId,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, content: input.content };
}

/**
 * Decrypt an email row's content field. Safe to call on rows that
 * are already plaintext (e.g. legacy rows that bypassed createEmail).
 */
export function decryptEmailContent<T extends { content: string }>(row: T): T {
  try {
    return { ...row, content: decrypt(row.content) };
  } catch {
    return row;
  }
}

/**
 * Fetch a thread with decrypted content, ordered oldest→newest.
 * Use this instead of raw supabase selects whenever you need the
 * human-readable body (e.g. feeding AI prompts).
 */
export async function getDecryptedThreadEmails(threadId: string) {
  const { data, error } = await supabase
    .from("Email")
    .select("*")
    .eq("threadId", threadId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(decryptEmailContent);
}