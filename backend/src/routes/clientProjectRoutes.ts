import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { listClientProjects, updateClientProject } from "../controllers/clientProjectController";

const router = Router();

router.use(requireAuth, requireTenant);
router.get("/", listClientProjects);
router.patch("/:personId", updateClientProject);

export default router;
