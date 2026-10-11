// backend/src/middleware/requireRole.ts
import { NextFunction, Request, Response } from "express";
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";
import { ApiError, AuthorizationError } from "./errorHandler";

export type UserRole = "CLIENT" | "STAFF";
export type StaffRole = "IT" | "ADMIN" | "SUPER_ADMIN";

export interface RoleInfo {
  role: UserRole;
  staffRole: StaffRole | null;
}

declare global {
  namespace Express {
    interface Request {
      // Populated lazily by the role middleware below so that several
      // role checks on the same request only hit the User table once.
      roleInfo?: RoleInfo;
    }
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === "CLIENT" || value === "STAFF";
}

function isStaffRole(value: unknown): value is StaffRole {
  return value === "IT" || value === "ADMIN" || value === "SUPER_ADMIN";
}

// The JWT only carries { sub, organizationId }, so role / staffRole have to
// come from the User table. Result is cached on `req.roleInfo`.
async function loadRoleInfo(req: Request): Promise<RoleInfo> {
  if (req.roleInfo) return req.roleInfo;

  if (!req.auth?.userId) {
    throw new ApiError(401, "Not authenticated");
  }

  const { data, error } = await supabase
    .from("User")
    .select("role, staffRole")
    .eq("id", req.auth.userId)
    .single();

  if (error || !data) {
    logger.warn(
      { userId: req.auth.userId, error: error?.message },
      "Role lookup failed: user not found"
    );
    throw new AuthorizationError("User account not found");
  }

  if (!isUserRole(data.role)) {
    logger.warn(
      { userId: req.auth.userId, role: data.role },
      "Role lookup failed: unrecognised role"
    );
    throw new AuthorizationError("User has no valid role");
  }

  const info: RoleInfo = {
    role: data.role,
    staffRole: isStaffRole(data.staffRole) ? data.staffRole : null,
  };

  req.roleInfo = info;
  return info;
}

/** Rejects anyone whose User.role is not STAFF. */
export async function requireStaff(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const { role } = await loadRoleInfo(req);
    if (role !== "STAFF") {
      throw new AuthorizationError("Staff access required");
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Rejects anyone who is not STAFF with one of the given staffRoles.
 * Intended to be chained after requireStaff, but is safe on its own:
 * a CLIENT has no staffRole and is always rejected.
 */
export function requireRole(roles: StaffRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { role, staffRole } = await loadRoleInfo(req);
      if (role !== "STAFF" || !staffRole || !roles.includes(staffRole)) {
        throw new AuthorizationError(
          `Requires one of the following staff roles: ${roles.join(", ")}`
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Rejects anyone whose User.role is not CLIENT. */
export async function requireClient(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const { role } = await loadRoleInfo(req);
    if (role !== "CLIENT") {
      throw new AuthorizationError("Client access required");
    }
    next();
  } catch (err) {
    next(err);
  }
}
