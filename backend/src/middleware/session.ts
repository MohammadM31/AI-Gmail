// backend/src/middleware/session.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto"; // ✅ ADDED
import jwt from "jsonwebtoken";
import { ApiError, AuthenticationError } from "./errorHandler";
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

interface TokenPayload {
  sub: string;
  organizationId: string;
  type: "access" | "refresh";
  jti?: string;
}

const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date }>();

export function generateAccessToken(userId: string, organizationId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  
  return jwt.sign(
    { sub: userId, organizationId, type: "access" },
    secret,
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  
  const token = jwt.sign(
    { sub: userId, type: "refresh", jti: crypto.randomUUID() }, // ✅ Now works
    secret,
    { expiresIn: "7d" }
  );
  
  refreshTokenStore.set(token, {
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  
  return token;
}

export function refreshAccessToken(refreshToken: string): { accessToken: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  
  try {
    const payload = jwt.verify(refreshToken, secret) as TokenPayload;
    if (payload.type !== "refresh") {
      return null;
    }
    
    const stored = refreshTokenStore.get(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      refreshTokenStore.delete(refreshToken);
      return null;
    }
    
    const accessToken = generateAccessToken(payload.sub, "org-id");
    return { accessToken };
  } catch (error) {
    return null;
  }
}

export function revokeRefreshToken(refreshToken: string): boolean {
  return refreshTokenStore.delete(refreshToken);
}

export function revokeAllRefreshTokens(userId: string): number {
  let count = 0;
  for (const [token, value] of refreshTokenStore) {
    if (value.userId === userId) {
      refreshTokenStore.delete(token);
      count++;
    }
  }
  return count;
}

export function validateSession(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AuthenticationError());
  }

  const token = header.slice("Bearer ".length);
  
  if (token === "dev-token" && process.env.NODE_ENV !== "production") {
    req.auth = {
      userId: "22222222-2222-2222-2222-222222222222",
      organizationId: "11111111-1111-1111-1111-111111111111"
    };
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");
    
    const payload = jwt.verify(token, secret) as TokenPayload;
    
    if (payload.type !== "access") {
      return next(new AuthenticationError("Invalid token type"));
    }
    
    req.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Token expired", "TOKEN_EXPIRED"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError("Invalid token"));
    }
    next(new AuthenticationError("Authentication failed"));
  }
}

setInterval(() => {
  const now = new Date();
  for (const [token, value] of refreshTokenStore) {
    if (value.expiresAt < now) {
      refreshTokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000);

logger.info(`Session management initialized with ${refreshTokenStore.size} active refresh tokens`);