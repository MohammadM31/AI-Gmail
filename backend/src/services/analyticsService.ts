import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

export type AnalyticsEvent =
  | "email_sent"
  | "ai_call"
  | "voice_used"
  | "chart_generated";

export async function trackEvent(
  userId: string,
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase
    .from("Analytics")
    .insert({ userId, eventType, metadata: metadata ?? null });
  if (error) {
    logger.warn({ error, eventType }, "analytics insert failed");
  }
}

export async function getUsageSummary(userId: string) {
  const { data, error } = await supabase
    .from("Analytics")
    .select("eventType, timestamp")
    .eq("userId", userId)
    .order("timestamp", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.eventType] = (counts[row.eventType] ?? 0) + 1;
  }
  return { counts, recent: data ?? [] };
}
