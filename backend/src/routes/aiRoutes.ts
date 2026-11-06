import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";
import { aiBudget } from "../middleware/aiBudget";
import {
  processMessage,
  generateChart,
  suggestRecipients,
  analyzeTopics,
} from "../controllers/aiController";

const router = Router();

router.use(requireAuth, aiRateLimiter);

router.post("/process", aiBudget, processMessage);
router.post("/generate-chart", aiBudget, generateChart);
router.post("/suggest-recipients", suggestRecipients);
router.post("/analyze-topics", analyzeTopics);

export default router;