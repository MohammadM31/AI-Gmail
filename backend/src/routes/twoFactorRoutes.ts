// backend/src/routes/twoFactorRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
} from "../services/twoFactorService";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

// Setup 2FA
router.post("/setup", async (req, res, next) => {
  try {
    const result = await setupTwoFactor(req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Enable 2FA
router.post("/enable", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const success = await enableTwoFactor(req.auth!.userId, token);
    if (!success) {
      throw new ApiError(400, "Invalid verification code");
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post("/disable", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const success = await disableTwoFactor(req.auth!.userId, token);
    if (!success) {
      throw new ApiError(400, "Invalid verification code");
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Regenerate backup codes
router.post("/backup-codes/regenerate", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const codes = await regenerateBackupCodes(req.auth!.userId, token);
    if (!codes) {
      throw new ApiError(400, "Invalid verification code");
    }
    res.json({ backupCodes: codes });
  } catch (error) {
    next(error);
  }
});

export default router;