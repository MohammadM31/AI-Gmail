// backend/src/routes/pipelineRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { requireStaff } from "../middleware/requireRole";
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
router.post("/:contactId/generate", requireStaff, generatePipeline);
router.post("/:contactId/update", requireStaff, updatePipeline);
router.put("/:pipelineId/stage/:stageId", requireStaff, updatePipelineStage);
router.put("/:pipelineId/stages", requireStaff, updatePipelineStages);
router.post("/:pipelineId/stage/:stageId/time", requireStaff, updateStageTimeTracking);
router.post("/suggest-template", suggestPipelineTemplate);
export default router;