// backend/src/utils/rateLimitHeaders.ts
import { Request, Response, NextFunction } from "express";

// Add rate limit headers to response
export function addRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  // These will be set by express-rate-limit automatically
  // We're just ensuring they're present
  
  // Set default headers if not already set
  if (!res.getHeader("RateLimit-Limit")) {
    res.setHeader("RateLimit-Limit", "100");
  }
  if (!res.getHeader("RateLimit-Remaining")) {
    res.setHeader("RateLimit-Remaining", "99");
  }
  if (!res.getHeader("RateLimit-Reset")) {
    // Set to 60 seconds from now
    res.setHeader("RateLimit-Reset", Math.ceil(Date.now() / 1000) + 60);
  }
  
  next();
}

// Custom rate limit headers for different endpoints
export function setAiRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-AI-RateLimit-Limit", "20");
  res.setHeader("X-AI-RateLimit-Remaining", "18");
  res.setHeader("X-AI-RateLimit-Reset", Math.ceil(Date.now() / 1000) + 60);
  next();
}

export function setEmailRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Email-RateLimit-Limit", "30");
  res.setHeader("X-Email-RateLimit-Remaining", "29");
  res.setHeader("X-Email-RateLimit-Reset", Math.ceil(Date.now() / 1000) + 60);
  next();
}

export function setAuthRateLimitHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Auth-RateLimit-Limit", "10");
  res.setHeader("X-Auth-RateLimit-Remaining", "9");
  res.setHeader("X-Auth-RateLimit-Reset", Math.ceil(Date.now() / 1000) + 900);
  next();
}