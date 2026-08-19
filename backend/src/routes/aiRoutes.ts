import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  processMessage,
  generateChart,
  suggestRecipients,
  analyzeTopics,
  testGenerate,
} from "../controllers/aiController";

const router = Router();

// ✅ Public test route (no auth)
router.post("/test", testGenerate);

// Protected routes
router.use(requireAuth, apiRateLimiter);

router.post("/process", processMessage);
router.post("/generate-chart", generateChart);
router.post("/suggest-recipients", suggestRecipients);
router.post("/analyze-topics", analyzeTopics);

export default router;