// backend/src/routes/pipelineRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import {
  getPipeline,
  generatePipeline,
  updatePipeline,
  updatePipelineStage,
  getPipelineMetrics,
} from "../controllers/pipelineController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/metrics", getPipelineMetrics); // ✅ NEW - must be before /:contactId
router.get("/:contactId", getPipeline);
router.post("/:contactId/generate", generatePipeline);
router.post("/:contactId/update", updatePipeline);
router.put("/:pipelineId/stage/:stageId", updatePipelineStage); // ✅ NEW

export default router;