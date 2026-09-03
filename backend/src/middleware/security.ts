// backend/src/middleware/security.ts
import { Request, Response, NextFunction } from "express";
import { ApiError } from "./errorHandler";
import { logger } from "../utils/logger";

// Blocked IPs (in production, use Redis or a database)
const blockedIPs = new Set<string>();

// IP blocking configuration
const IP_BLOCK_CONFIG = {
  maxAttempts: 10, // Max failed attempts before blocking
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDuration: 60 * 60 * 1000, // 1 hour
};

// Track failed attempts
const failedAttempts = new Map<string, { count: number; firstAttempt: Date }>();

// Middleware to block suspicious IPs
export function blockSuspiciousIPs(req: Request, _res: Response, next: NextFunction) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  
  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    logger.warn({ ip }, "Blocked request from suspicious IP");
    return next(new ApiError(403, "Access denied. Please try again later."));
  }
  
  next();
}

// Track failed authentication attempts
export function trackFailedAttempt(req: Request, _res: Response, next: NextFunction) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  
  // Only track auth endpoints
  if (!req.path.startsWith("/api/auth")) {
    return next();
  }
  
  // This middleware should be used after the actual auth attempt fails
  // It will be called from the error handler or from the auth routes
  
  // Store the request for use in error handler
  (req as any).trackIp = ip;
  
  next();
}

// Record a failed attempt (call this from auth controller on failure)
export function recordFailedAttempt(ip: string): void {
  const now = new Date();
  const attempt = failedAttempts.get(ip);
  
  if (!attempt) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  
  // Check if window has expired
  if (now.getTime() - attempt.firstAttempt.getTime() > IP_BLOCK_CONFIG.windowMs) {
    // Reset window
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  
  // Increment attempts
  attempt.count++;
  
  if (attempt.count >= IP_BLOCK_CONFIG.maxAttempts) {
    // Block the IP
    blockedIPs.add(ip);
    logger.warn({ ip, attempts: attempt.count }, "IP blocked due to excessive failed attempts");
    
    // Schedule unblock
    setTimeout(() => {
      blockedIPs.delete(ip);
      failedAttempts.delete(ip);
      logger.info({ ip }, "IP unblocked after cool-down period");
    }, IP_BLOCK_CONFIG.blockDuration);
  }
}

// Security headers middleware (additional to Helmet)
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(self), camera=(), payment=()"
  );
  
  // Strict Transport Security (already in Helmet, but ensure it's set)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  
  next();
}

// Request validation middleware (prevent large payloads)
export function validateRequestSize(req: Request, res: Response, next: NextFunction) {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > MAX_SIZE) {
    return next(new ApiError(413, "Request payload too large"));
  }
  
  next();
}

// Clean up expired IP blocks periodically
setInterval(() => {
  // This is handled by the setTimeout in recordFailedAttempt
  // but we also clean up old attempts
  const now = new Date();
  for (const [ip, attempt] of failedAttempts) {
    if (now.getTime() - attempt.firstAttempt.getTime() > IP_BLOCK_CONFIG.windowMs) {
      failedAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000); // Every hour