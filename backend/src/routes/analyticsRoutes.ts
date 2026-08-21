import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { usage, topics, topicTrends, exportCsv } from "../controllers/analyticsController";

const router = Router();
router.use(requireAuth);

router.get("/usage", usage);
router.get("/topics", topics);
router.get("/topics/trends", topicTrends);
router.get("/export", exportCsv);

export default router;