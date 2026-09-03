// backend/src/middleware/csrf.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { ApiError } from "./errorHandler";

// Generate CSRF token
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Store CSRF tokens (in production, use Redis or a database)
// This is a simple in-memory store for demonstration
const tokenStore = new Map<string, { token: string; expiresAt: Date }>();

// Generate and store a CSRF token for a user
export function createCsrfToken(userId: string): string {
  const token = generateCsrfToken();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour
  
  tokenStore.set(userId, { token, expiresAt });
  
  // Clean up expired tokens periodically
  setTimeout(() => {
    for (const [key, value] of tokenStore) {
      if (value.expiresAt < new Date()) {
        tokenStore.delete(key);
      }
    }
  }, 60000); // Check every minute
  
  return token;
}

// Validate CSRF token
export function validateCsrfToken(userId: string, token: string): boolean {
  const stored = tokenStore.get(userId);
  if (!stored) return false;
  if (stored.expiresAt < new Date()) {
    tokenStore.delete(userId);
    return false;
  }
  return stored.token === token;
}

// Middleware to validate CSRF token for state-changing requests
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  // Skip for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip for auth endpoints (they use different authentication)
  if (req.path.startsWith("/api/auth")) {
    return next();
  }

  const userId = req.auth?.userId;
  if (!userId) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = req.headers["x-csrf-token"] as string;
  if (!token) {
    return next(new ApiError(403, "CSRF token required"));
  }

  if (!validateCsrfToken(userId, token)) {
    return next(new ApiError(403, "Invalid or expired CSRF token"));
  }

  next();
}

// Middleware to provide CSRF token to the client
export function csrfTokenProvider(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.userId) {
    const token = createCsrfToken(req.auth.userId);
    res.setHeader("X-CSRF-Token", token);
  }
  next();
}