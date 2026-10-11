// backend/src/services/sprintService.ts
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

export interface Sprint {
  id: string;
  organizationId: string;
  weekStart: string;
  weekEnd: string;
  status: "OPEN" | "ANALYZING" | "READY" | "CLOSED";
  analyzedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Given an org's timezone (IANA string) and a reference date,
 * return the sprint window that contains that date.
 *
 * Sprint = Saturday 00:00:00 → Friday 23:59:59.999 (local)
 */
function getSprintBounds(timezone: string, reference: Date): { start: Date; end: Date } {
  // Format the reference date into the target timezone to get local Y/M/D/DoW
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(reference);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekdayStr = get("weekday"); // "Mon", "Tue", ...

  // Day of week: 0 = Sunday, ..., 6 = Saturday
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dow = dowMap[weekdayStr];

  // If today is Sat (6), sprint started today.
  // Otherwise, sprint started on the most recent Saturday.
  // Distance back to Saturday:  (dow - 6 + 7) % 7
  const daysBackToSat = (dow - 6 + 7) % 7;

  // Local Y/M/D of sprint start (in the org's timezone)
  const localStartYMD = new Date(Date.UTC(year, month - 1, day - daysBackToSat));
  const localEndYMD = new Date(Date.UTC(year, month - 1, day - daysBackToSat + 6));

  // Convert "local YMD at 00:00:00" to UTC using the target timezone.
  // Strategy: format our candidate UTC instant into the target tz,
  // compare to what we want, and adjust the offset.
  const start = zonedMidnightToUTC(
    localStartYMD.getUTCFullYear(),
    localStartYMD.getUTCMonth() + 1,
    localStartYMD.getUTCDate(),
    timezone
  );

  const endExclusive = new Date(
    zonedMidnightToUTC(
      localEndYMD.getUTCFullYear(),
      localEndYMD.getUTCMonth() + 1,
      localEndYMD.getUTCDate(),
      timezone
    ).getTime() +
      24 * 60 * 60 * 1000 -
      1
  );

  return { start, end: endExclusive };
}

/**
 * Convert (Y, M, D) at 00:00:00 in the target timezone to a UTC Date.
 * Uses a two-pass offset calculation to handle DST correctly.
 */
function zonedMidnightToUTC(y: number, m: number, d: number, timezone: string): Date {
  // First guess: treat it as UTC
  let guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

  // Check what that UTC instant looks like in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");

  const localY = get("year");
  const localM = get("month");
  const localD = get("day");
  const localH = get("hour");
  const localMin = get("minute");

  // If our guess already renders as (y, m, d, 00:00) in the target tz, done.
  if (localY === y && localM === m && localD === d && localH === 0 && localMin === 0) {
    return guess;
  }

  // Otherwise compute the delta in minutes and adjust
  const guessUTCms = Date.UTC(localY, localM - 1, localD, localH, localMin, 0, 0);
  const targetUTCms = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const deltaMs = targetUTCms - guessUTCms;

  return new Date(guess.getTime() + deltaMs);
}

/**
 * Get or create the sprint that covers `reference` for this org.
 * Idempotent — safe to call from multiple places.
 */
export async function getOrCreateCurrentSprint(
  organizationId: string,
  reference: Date = new Date()
): Promise<Sprint> {
  // Fetch the org's timezone
  const { data: org, error: orgErr } = await supabase
    .from("Organization")
    .select("timezone")
    .eq("id", organizationId)
    .single();

  if (orgErr || !org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const timezone = org.timezone || "Asia/Beirut";
  const { start, end } = getSprintBounds(timezone, reference);

  // Try to find an existing sprint for this window
  const { data: existing, error: selErr } = await supabase
    .from("Sprint")
    .select("*")
    .eq("organizationId", organizationId)
    .eq("weekStart", start.toISOString())
    .maybeSingle();

  if (selErr) {
    throw new Error(`Failed to look up sprint: ${selErr.message}`);
  }

  if (existing) return existing as Sprint;

  // Create it
  const { data: created, error: insErr } = await supabase
    .from("Sprint")
    .insert({
      organizationId,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      status: "OPEN",
    })
    .select()
    .single();

  if (insErr || !created) {
    // Race condition: another process created it between select and insert.
    // Try to fetch it again.
    const { data: retry } = await supabase
      .from("Sprint")
      .select("*")
      .eq("organizationId", organizationId)
      .eq("weekStart", start.toISOString())
      .single();

    if (retry) return retry as Sprint;

    throw new Error(`Failed to create sprint: ${insErr?.message}`);
  }

  logger.info(
    { organizationId, weekStart: start.toISOString(), weekEnd: end.toISOString() },
    "Sprint created"
  );

  return created as Sprint;
}

/**
 * Mark a sprint as READY (analysis complete, waiting on team).
 */
export async function markSprintReady(sprintId: string): Promise<void> {
  await supabase
    .from("Sprint")
    .update({ status: "READY", analyzedAt: new Date().toISOString() })
    .eq("id", sprintId);
}

/**
 * Mark a sprint as CLOSED.
 */
export async function closeSprint(sprintId: string): Promise<void> {
  await supabase
    .from("Sprint")
    .update({ status: "CLOSED", closedAt: new Date().toISOString() })
    .eq("id", sprintId);
}

/**
 * Utility: given a timezone, is it currently Saturday 00:00–01:00 local?
 * Used by the cron to decide whether to run the weekly analysis.
 */
export function isSprintRolloverHour(timezone: string, now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  return weekday === "Sat" && hour === 0;
}