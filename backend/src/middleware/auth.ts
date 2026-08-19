import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; organizationId: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");
    const payload = jwt.verify(token, secret) as {
      sub: string;
      organizationId: string;
    };
    req.auth = { userId: payload.sub, organizationId: payload.organizationId };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}
