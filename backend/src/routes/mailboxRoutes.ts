import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  addRule,
  addShare,
  getMailbox,
  removeRule,
  removeShare,
  updateMailbox,
} from "../controllers/mailboxController";

const router = Router();
router.use(requireAuth, requireTenant, apiRateLimiter);

router.get("/", getMailbox);
router.patch("/", updateMailbox);
router.post("/shares", addShare);
router.delete("/shares/:userId", removeShare);
router.post("/rules", addRule);
router.delete("/rules/:ruleId", removeRule);

export default router;
