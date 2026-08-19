import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../controllers/templateController";

const router = Router();
router.use(requireAuth);

router.get("/", listTemplates);
router.post("/", createTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;
