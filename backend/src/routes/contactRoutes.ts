import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import {
  listContacts,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactById,
  getContactSummary,
  getContactThreads,
} from "../controllers/contactController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/", listContacts);
router.get("/search", searchContacts);
router.get("/:id", getContactById);
router.get("/:id/summary", getContactSummary);
router.get("/:id/threads", getContactThreads);
router.post("/", createContact);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

export default router;