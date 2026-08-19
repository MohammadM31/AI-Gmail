import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { usage, topics, exportCsv } from "../controllers/analyticsController";

const router = Router();
router.use(requireAuth);

router.get("/usage", usage);
router.get("/topics", topics);
router.get("/export", exportCsv);

export default router;
