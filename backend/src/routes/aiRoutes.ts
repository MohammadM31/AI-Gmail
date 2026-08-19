import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  processMessage,
  generateChart,
  suggestRecipients,
  analyzeTopics,
} from "../controllers/aiController";

const router = Router();
router.use(requireAuth, apiRateLimiter);

router.post("/process", processMessage);
router.post("/generate-chart", generateChart);
router.post("/suggest-recipients", suggestRecipients);
router.post("/analyze-topics", analyzeTopics);
// /summarize-thread lives on emailRoutes as GET /api/emails/summary/:threadId
// to keep the thread data access consolidated with the rest of email reads.

export default router;
