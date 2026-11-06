import { Router } from "express";
import {
  register,
  login,
  logout,
  refresh,
  me,
  getInviteCode,
  regenerateInviteCode,
} from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { requireStaff, requireRole } from "../middleware/requireRole";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", requireAuth, refresh);
router.get("/me", requireAuth, me);

router.get("/org/invite-code", requireAuth, requireTenant, requireStaff, getInviteCode);
router.post(
  "/org/invite-code/regenerate",
  requireAuth,
  requireTenant,
  requireStaff,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  regenerateInviteCode
);

export default router;
