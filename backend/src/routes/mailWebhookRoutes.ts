import { Router } from "express";
import { bounceMail, inboundMail } from "../controllers/mailboxController";

const router = Router();
router.post("/inbound", inboundMail);
router.post("/bounce", bounceMail);

export default router;
