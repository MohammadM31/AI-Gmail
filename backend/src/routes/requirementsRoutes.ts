import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { requireStaff, requireRole } from "../middleware/requireRole";

import {
  listProjects,
  createProject,
  analyzeRequirements,
  listRequirements,
  createProposal,
  listModifications,
  reviewModification,
} from "../controllers/requirementsController";

import { runSweeper } from "../controllers/requirementsSweeperController";

const router = Router();

router.use(requireAuth, requireTenant);

router.get("/projects", requireStaff, listProjects);
router.post("/projects", requireStaff, createProject);

router.post("/analyze", requireStaff, analyzeRequirements);

router.get("/requirements", requireStaff, listRequirements);

router.post("/proposals", requireStaff, createProposal);

router.get("/modifications", requireStaff, listModifications);

router.patch(
  "/modifications/:modificationId/review",
  requireStaff,
  requireRole(["IT", "ADMIN", "SUPER_ADMIN"]),
  reviewModification
);

// NEW: manual sweeper trigger (staff only)
router.post(
  "/run-sweeper",
  requireStaff,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  runSweeper
);

export default router;