import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { requireStaff } from "../middleware/requireRole";
import { createDigest } from "../controllers/digestController";

const router = Router();

router.use(requireAuth, requireTenant, requireStaff);
router.post("/", createDigest);

export default router;
