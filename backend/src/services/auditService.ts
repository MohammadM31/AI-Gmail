import { Request } from "express";
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

interface AuditEntry {
  userId: string;
  action: string;
  emailId?: string;
  aiInput?: string;
  aiOutput?: unknown;
  req?: Request;
}

// Best-effort — a failed audit write should never fail the user's request.
export async function logAudit(entry: AuditEntry) {
  const { error } = await supabase.from("AuditLog").insert({
    userId: entry.userId,
    action: entry.action,
    emailId: entry.emailId ?? null,
    aiInput: entry.aiInput ?? null,
    aiOutput: entry.aiOutput ?? null,
    ipAddress: entry.req?.ip ?? null,
    userAgent: entry.req?.headers["user-agent"] ?? null,
  });
  if (error) {
    logger.warn({ error, action: entry.action }, "audit log insert failed");
  }
}
