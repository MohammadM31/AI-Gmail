import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  sendScheduledTemplates,
  sendTemplateNow,
} from "../controllers/templateController";

const router = Router();
router.use(requireAuth);

router.get("/", listTemplates);
router.get("/:id", getTemplate);
router.post("/", createTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

// ✅ NEW: Scheduled template endpoints
router.post("/send-scheduled", sendScheduledTemplates);
router.post("/:id/send", sendTemplateNow);

export default router;