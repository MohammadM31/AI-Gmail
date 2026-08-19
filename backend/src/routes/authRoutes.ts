import { Router } from "express";
import {
  register,
  login,
  logout,
  me,
  getInviteCode,
  regenerateInviteCode,
} from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

router.get("/org/invite-code", requireAuth, requireTenant, getInviteCode);
router.post("/org/invite-code/regenerate", requireAuth, requireTenant, regenerateInviteCode);

export default router;
