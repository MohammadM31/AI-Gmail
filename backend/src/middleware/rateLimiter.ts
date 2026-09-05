// backend/src/middleware/rateLimiter.ts
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { RateLimitError } from "./errorHandler";
import { Request, Response, NextFunction } from "express";

const createRateLimiter = (
  options: Partial<rateLimit.Options> = {}
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.auth?.userId || req.ip || "anonymous";
    },
    handler: (req: Request, res: Response) => {
      throw new RateLimitError("Too many requests, please try again later");
    },
    skip: (req: Request) => {
      return req.path === "/health";
    },
    ...options,
  });
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => {
    return (req.body?.email as string) || req.ip || "anonymous";
  },
});

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

export const emailRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => req.auth?.userId || req.ip || "anonymous",
});

export function addRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  next();
}