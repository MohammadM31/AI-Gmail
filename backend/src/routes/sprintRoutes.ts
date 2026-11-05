import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { requireStaff } from "../middleware/requireRole";
import {
  getCurrentSprint,
  listSprints,
  getSprint,
  markReady,
  closeSprintHandler,
} from "../controllers/sprintController";

const router = Router();

// Sprints are an internal staff workflow.
router.use(requireAuth, requireTenant, requireStaff);

router.get("/current", getCurrentSprint); // must stay above "/:id"
router.get("/", listSprints);
router.get("/:id", getSprint);
router.post("/:id/ready", markReady);
router.post("/:id/close", closeSprintHandler);

export default router;
