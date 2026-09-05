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
  status?: "draft" | "sent"; // ✅ ADDED
  sentAt?: string; // ✅ ADDED
}

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

export function decryptEmailContent<T extends { content: string }>(row: T): T {
  try {
    return { ...row, content: decrypt(row.content) };
  } catch {
    return row;
  }
}