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
  listPipelines,
  listPipelineComments,
  addPipelineComment,
  deletePipelineComment,
} from "../controllers/pipelineController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/", requireStaff, listPipelines);
router.get("/metrics", requireStaff, getPipelineMetrics);
router.get("/notifications", requireStaff, getPipelineNotifications);
router.get("/:pipelineId/comments", requireStaff, listPipelineComments);
router.post("/:pipelineId/comments", requireStaff, addPipelineComment);
router.delete("/:pipelineId/comments/:commentId", requireStaff, deletePipelineComment);
router.get("/:contactId", requireStaff, getPipeline);
router.post("/:contactId/generate", requireStaff, generatePipeline);
router.post("/:contactId/update", requireStaff, updatePipeline);
router.put("/:pipelineId/stage/:stageId", requireStaff, updatePipelineStage);
router.put("/:pipelineId/stages", requireStaff, updatePipelineStages);
router.post("/:pipelineId/stage/:stageId/time", requireStaff, updateStageTimeTracking);
router.post("/suggest-template", requireStaff, suggestPipelineTemplate);
export default router;