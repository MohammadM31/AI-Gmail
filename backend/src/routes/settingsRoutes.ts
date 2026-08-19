import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { getSettings, updateSettings } from "../controllers/settingsController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
