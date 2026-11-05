// backend/src/controllers/bulkEmailController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { emailContentSchema } from "../utils/validators";
import { sendBulkEmail, scheduleBulkEmail } from "../services/bulkEmailService";

// Accept either plain email strings or { name, email } objects.
const recipientInput = z.union([
  z.string().email("Invalid email format"),
  z.object({
    name: z.string().max(200).optional(),
    email: z.string().email("Invalid email format"),
  }),
]);

const bulkSchema = z.object({
  recipients: z
    .array(recipientInput)
    .min(1, "At least one recipient is required")
    .max(100, "Maximum 100 recipients per batch"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject exceeds maximum length"),
  content: emailContentSchema,
  bulletPoints: z.array(z.string().max(500)).max(20).optional(),
  scheduleDate: z.string().datetime({ offset: true }).optional(),
});

function normalizeRecipients(input: z.infer<typeof bulkSchema>["recipients"]) {
  const seen = new Set<string>();
  const out: { name: string; email: string }[] = [];

  for (const r of input) {
    const email = (typeof r === "string" ? r : r.email).trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);

    const name = typeof r === "string" ? "" : r.name?.trim() ?? "";
    out.push({ name: name || email.split("@")[0], email });
  }
  return out;
}

/**
 * POST /api/emails/bulk
 * Sends (200) or schedules (202) one personalised email per recipient.
 * {name} and {email} placeholders in subject/content are substituted.
 */
export async function bulkSend(req: Request, res: Response, next: NextFunction) {
  try {
    const input = bulkSchema.parse(req.body);
    const recipients = normalizeRecipients(input.recipients);

    if (input.scheduleDate) {
      if (new Date(input.scheduleDate).getTime() <= Date.now()) {
        throw new ApiError(400, "scheduleDate must be in the future");
      }

      const job = await scheduleBulkEmail({
        senderId: req.auth!.userId,
        recipients,
        subject: input.subject,
        content: input.content,
        bulletPoints: input.bulletPoints ?? [],
        scheduleDate: input.scheduleDate,
      });

      return res.status(202).json(job);
    }

    const result = await sendBulkEmail({
      senderId: req.auth!.userId,
      recipients,
      subject: input.subject,
      content: input.content,
      bulletPoints: input.bulletPoints ?? [],
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
