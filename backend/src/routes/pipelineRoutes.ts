// backend/src/routes/pipelineRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import {
  getPipeline,
  generatePipeline,
  updatePipeline,
  updatePipelineStage,
  updatePipelineStages,
  getPipelineMetrics,
  getPipelineNotifications,
  suggestPipelineTemplate,
  updateStageTimeTracking,
} from "../controllers/pipelineController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/metrics", getPipelineMetrics);
router.get("/notifications", getPipelineNotifications);
router.get("/:contactId", getPipeline);
router.post("/:contactId/generate", generatePipeline);
router.post("/:contactId/update", updatePipeline);
router.put("/:pipelineId/stage/:stageId", updatePipelineStage);
router.put("/:pipelineId/stages", updatePipelineStages);
router.post("/:pipelineId/stage/:stageId/time", updateStageTimeTracking);
router.post("/suggest-template", suggestPipelineTemplate);
export default router;