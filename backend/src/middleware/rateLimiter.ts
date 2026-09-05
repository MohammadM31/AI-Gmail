// backend/src/middleware/rateLimiter.ts
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { RateLimitError } from "./errorHandler";
import { Request, Response, NextFunction } from "express";

// Base rate limiter configuration
const createRateLimiter = (
  options: Partial<rateLimit.Options> = {}
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute default
    max: 100, // 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise IP
      return req.auth?.userId || req.ip || "anonymous";
    },
    handler: (req: Request, res: Response) => {
      throw new RateLimitError("Too many requests, please try again later");
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === "/health";
    },
    ...options,
  });
};

// Different rate limiters for different endpoints
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  keyGenerator: (req: Request) => {
    // Use email for auth endpoints
    return (req.body?.email as string) || req.ip || "anonymous";
  },
});

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20, // 20 AI calls per minute
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

export const emailRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30, // 30 emails per minute
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10, // 10 uploads per minute
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

// Export rate limit headers middleware
export function addRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  // This will be handled by express-rate-limit automatically
  // This is just a placeholder for custom rate limit headers
  next();
}