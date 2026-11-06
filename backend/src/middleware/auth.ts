import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../utils/supabaseClient";
import { readCookieHeader, sessionKnown } from "../utils/jwt";
import { ApiError } from "./errorHandler";
import { csrfProtection } from "./csrf";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; organizationId: string; sessionId?: string };
    }
  }
}

async function sessionActive(sessionId: string | undefined): Promise<boolean> {
  const known = sessionKnown(sessionId);
  if (known !== null) return known;
  const { data, error } = await supabase
    .from("AuthSession")
    .select("revoked, expiresAt")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data || data.revoked) return false;
  return new Date(data.expiresAt).getTime() > Date.now();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const cookie = bearer ? "" : readCookieHeader(req.headers.cookie, "app_session");
  const token = bearer || cookie;
  if (!token) {
    return next(new ApiError(401, "Missing Authorization header"));
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");
    const payload = jwt.verify(token, secret) as {
      sub?: string;
      organizationId?: string;
      sid?: string;
    };
    if (!payload.sub || !payload.organizationId) {
      return next(new ApiError(401, "Invalid or expired token"));
    }
    if (!bearer) {
      if (!(await sessionActive(payload.sid))) {
        return next(new ApiError(401, "Session ended"));
      }
      req.auth = { userId: payload.sub, organizationId: payload.organizationId, sessionId: payload.sid };
      return csrfProtection(req, res, next);
    }
    req.auth = { userId: payload.sub, organizationId: payload.organizationId };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}