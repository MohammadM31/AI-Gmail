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
}

export async function createEmail(input: CreateEmailInput) {
  // Every email is the head of a thread, even a brand-new one that
  // isn't a reply to anything yet — otherwise it's created with
  // threadId: null and the frontend has no threadId to navigate to,
  // so clicking it in the inbox can never open the thread/summary/
  // reply view. Generate the id ourselves so it can double as its
  // own threadId in a single insert.
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
      status: "draft",
      threadId,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, content: input.content }; // return plaintext to caller
}

export function decryptEmailContent<T extends { content: string }>(row: T): T {
  try {
    return { ...row, content: decrypt(row.content) };
  } catch {
    // Row predates encryption or key rotated — surface raw value rather
    // than throwing and breaking the whole list.
    return row;
  }
}