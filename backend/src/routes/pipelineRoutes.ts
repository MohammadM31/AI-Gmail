// backend/src/routes/pipelineRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import {
  getPipeline,
  generatePipeline,
  updatePipeline,
} from "../controllers/pipelineController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/:contactId", getPipeline);
router.post("/:contactId/generate", generatePipeline);
router.post("/:contactId/update", updatePipeline);

export default router;