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
  const { data, error } = await supabase
    .from("Email")
    .insert({
      senderId: input.senderId,
      recipients: input.recipients,
      subject: input.subject,
      content: encrypt(input.content),
      bulletPoints: input.bulletPoints,
      chartData: input.chartData ?? null,
      attachments: input.attachments ?? [],
      status: "draft",
      threadId: input.threadId ?? null,
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
