import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { getTasks, postTask } from "../controllers/taskController";

const router = Router();

router.use(requireAuth, requireTenant);
router.get("/", getTasks);
router.post("/", postTask);

export default router;
