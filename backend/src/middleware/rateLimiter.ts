// backend/src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

/**
 * General-purpose limiter for data routes: 100 requests / minute / IP.
 * Applied broadly in app.ts and per-route where needed.
 */
export const apiRateLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many requests, please try again later.",
    },
  },
});

/**
 * Tighter limiter for AI calls: 20 requests / minute / IP.
 * Applied to /api/ai/* routes.
 */
export const aiRateLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "AI rate limit exceeded. Please wait a moment and try again.",
    },
  },
});

/**
 * Auth-endpoint limiter: stricter to slow down credential stuffing.
 */
export const authRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many login attempts. Please try again later.",
    },
  },
});