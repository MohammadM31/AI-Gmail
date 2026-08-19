import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";

// Runs after requireAuth. Ensures every data-access route has an
// organizationId to scope queries by, so one tenant can never read
// another's rows even if an id is guessed.
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.organizationId) {
    return next(new ApiError(403, "No organization context for this request"));
  }
  next();
}
