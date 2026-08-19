import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import {
  listContacts,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
} from "../controllers/contactController";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/", listContacts);
router.get("/search", searchContacts);
router.post("/", createContact);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

export default router;
