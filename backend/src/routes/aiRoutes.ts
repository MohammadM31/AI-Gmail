import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";
import {
  processMessage,
  generateChart,
  suggestRecipients,
  analyzeTopics,
} from "../controllers/aiController";

const router = Router();

router.use(requireAuth, aiRateLimiter);

router.post("/process", processMessage);
router.post("/generate-chart", generateChart);
router.post("/suggest-recipients", suggestRecipients);
router.post("/analyze-topics", analyzeTopics);

export default router;