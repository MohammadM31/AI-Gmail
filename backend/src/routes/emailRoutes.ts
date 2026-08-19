import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireTenant } from "../middleware/tenant";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  listEmails,
  getEmail,
  createEmailHandler,
  updateEmail,
  deleteEmail,
  sendEmail,
  getThread,
  summarizeThread,
  readReceipt,
} from "../controllers/emailController";
import { createUploadUrl, getSignedDownloadUrl } from "../controllers/attachmentController";

const router = Router();
router.use(requireAuth, requireTenant, apiRateLimiter);

router.post("/attachments/upload-url", createUploadUrl);
router.get("/attachments/signed-url", getSignedDownloadUrl);

router.get("/", listEmails);
router.post("/create", createEmailHandler);
router.get("/thread/:threadId", getThread);
router.get("/summary/:threadId", summarizeThread);
router.get("/:id", getEmail);
router.put("/:id", updateEmail);
router.delete("/:id", deleteEmail);
router.post("/:id/send", sendEmail);
router.post("/:id/read-receipt", readReceipt);

export default router;
