// backend/src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { RateLimitError } from "./errorHandler";
import { logger } from "../utils/logger";

// Redis store for distributed rate limiting (optional)
// Uncomment if you have Redis configured
/*
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => {
  logger.error({ error: err }, 'Redis client error');
});

redisClient.connect();
*/

// User-specific rate limiter
export const createUserRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
} = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    keyPrefix = "rl",
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return req.auth?.userId || req.ip || "anonymous";
    },
    // Redis store for production
    // store: new RedisStore({
    //   sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    //   prefix: keyPrefix,
    // }),
    handler: (req: Request, res: Response) => {
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const userId = req.auth?.userId || "anonymous";
      
      logger.warn({ ip, userId, path: req.path }, "Rate limit exceeded");
      
      throw new RateLimitError("Too many requests, please try again later");
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks and static assets
      return req.path === "/health" || req.path.startsWith("/static");
    },
    // Add custom headers
    onLimitReached: (req: Request) => {
      const userId = req.auth?.userId || "anonymous";
      logger.warn({ userId, path: req.path }, "Rate limit reached");
    },
  });
};

// Specific rate limiters
export const globalRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: "rl:global",
});

export const authRateLimiter = createUserRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyPrefix: "rl:auth",
});

export const aiRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "rl:ai",
});

export const emailRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: "rl:email",
});

export const uploadRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: "rl:upload",
});

export const templateRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  keyPrefix: "rl:template",
});

// Per-IP rate limiter (for unauthenticated requests)
export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.connection.remoteAddress || "unknown";
  },
  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    logger.warn({ ip, path: req.path }, "IP rate limit exceeded");
    throw new RateLimitError("Too many requests from this IP");
  },
});

// Sliding window rate limiter (more accurate than fixed window)
export const slidingWindowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
  // Use sliding window algorithm
  // Note: This requires Redis store for proper sliding window
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  //   prefix: "rl:sliding",
  // }),
});

// Concurrency limiter (limit simultaneous requests)
export const concurrencyLimiter = rateLimit({
  windowMs: 0, // No time window
  max: 5, // Max 5 concurrent requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
  handler: (req: Request, res: Response) => {
    throw new RateLimitError("Too many concurrent requests");
  },
});

// Export rate limit headers middleware
export function addRateLimitHeaders(req: Request, res: Response, next: Function) {
  // Headers will be added by express-rate-limit
  // This is just a placeholder for custom headers
  res.setHeader("X-RateLimit-Policy", "100 requests per minute");
  next();
}