import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AuthenticationError, RateLimitError } from "./errorHandler";

/**
 * Cost budget for routes that generate mail or infographics. One call can reach
 * the AI provider, spawn Python and upload a PNG, so this is a separate, much
 * tighter cap than the generic per-minute limiter. It is counted per user id
 * and per organization id over a rolling hour.
 *
 * Limits come from env so they can be tuned without a deploy:
 *   AI_BUDGET_USER_PER_HOUR  (default 10)
 *   AI_BUDGET_ORG_PER_HOUR   (default 50)
 *
 * State is in memory, so each server instance enforces its own budget. Move the
 * counters to a shared store before running more than one instance.
 */

const HOUR_MS = 60 * 60 * 1000;
const SWEEP_EVERY_MS = 10 * 60 * 1000;

export const DEFAULT_USER_PER_HOUR = 10;
export const DEFAULT_ORG_PER_HOUR = 50;

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function aiBudgetLimits(): { user: number; org: number } {
  return {
    user: positiveInt("AI_BUDGET_USER_PER_HOUR", DEFAULT_USER_PER_HOUR),
    org: positiveInt("AI_BUDGET_ORG_PER_HOUR", DEFAULT_ORG_PER_HOUR),
  };
}

type Hits = Map<string, number[]>;

function recent(store: Hits, key: string, now: number): number[] {
  const cutoff = now - HOUR_MS;
  const existing = store.get(key) ?? [];
  const kept = existing.filter((at) => at > cutoff);
  store.set(key, kept);
  return kept;
}

function sweep(store: Hits, now: number): void {
  const cutoff = now - HOUR_MS;
  for (const [key, hits] of store) {
    const kept = hits.filter((at) => at > cutoff);
    if (kept.length === 0) store.delete(key);
    else store.set(key, kept);
  }
}

function waitText(hits: number[], max: number, now: number): { seconds: number; text: string } {
  // The caller may only go again once enough old hits have left the window.
  const releasing = hits[Math.max(0, hits.length - max)] ?? now;
  const seconds = Math.max(1, Math.ceil((releasing + HOUR_MS - now) / 1000));
  const minutes = Math.ceil(seconds / 60);
  return { seconds, text: `about ${minutes} minute${minutes === 1 ? "" : "s"}` };
}

export interface AiBudgetOptions {
  now?: () => number;
}

export function createAiBudget(options: AiBudgetOptions = {}): RequestHandler {
  const clock = options.now ?? Date.now;
  const users: Hits = new Map();
  const orgs: Hits = new Map();
  let lastSweep = clock();

  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth;
    // requireAuth must run first; never fall back to an anonymous bucket.
    if (!auth) return next(new AuthenticationError());

    const now = clock();
    if (now - lastSweep >= SWEEP_EVERY_MS) {
      sweep(users, now);
      sweep(orgs, now);
      lastSweep = now;
    }

    const limits = aiBudgetLimits();
    const userHits = recent(users, auth.userId, now);
    const orgHits = recent(orgs, auth.organizationId, now);

    // Check both before counting either, so a refused call never spends budget.
    if (userHits.length >= limits.user) {
      const wait = waitText(userHits, limits.user, now);
      res.setHeader("Retry-After", String(wait.seconds));
      return next(
        new RateLimitError(
          `AI generation limit reached: ${limits.user} per hour per user. Try again in ${wait.text}.`
        )
      );
    }
    if (orgHits.length >= limits.org) {
      const wait = waitText(orgHits, limits.org, now);
      res.setHeader("Retry-After", String(wait.seconds));
      return next(
        new RateLimitError(
          `Your organization has reached its AI generation limit of ${limits.org} per hour. Try again in ${wait.text}.`
        )
      );
    }

    userHits.push(now);
    orgHits.push(now);
    res.setHeader("X-AI-Budget-User-Remaining", String(limits.user - userHits.length));
    res.setHeader("X-AI-Budget-Org-Remaining", String(limits.org - orgHits.length));

    // A request rejected as a client error (bad body) never reached the AI
    // provider, so give its slot back. Server errors stay counted.
    res.once("finish", () => {
      if (res.statusCode < 400 || res.statusCode >= 500) return;
      for (const [store, key] of [
        [users, auth.userId],
        [orgs, auth.organizationId],
      ] as const) {
        const hits = store.get(key);
        const index = hits ? hits.indexOf(now) : -1;
        if (hits && index !== -1) hits.splice(index, 1);
      }
    });

    next();
  };
}

export const aiBudget: RequestHandler = createAiBudget();
