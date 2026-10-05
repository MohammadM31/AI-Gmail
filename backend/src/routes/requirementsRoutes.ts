import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";

import {
  listProjects,
  createProject,
  analyzeRequirements,
  listRequirements,
  createProposal,
  listModifications,
  reviewModification,
} from "../controllers/requirementsController";

const router = Router();

router.use(requireAuth, requireTenant);

router.get("/projects", listProjects);
router.post("/projects", createProject);

router.post("/analyze", analyzeRequirements);

router.get("/requirements", listRequirements);

router.post("/proposals", createProposal);

router.get("/modifications", listModifications);

router.patch(
  "/modifications/:modificationId/review",
  reviewModification
);

export default router;
