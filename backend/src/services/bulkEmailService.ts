// backend/src/services/bulkEmailService.ts
import { supabase } from "../utils/supabaseClient";
import { createEmail } from "./emailProcessor";
import { trackEvent } from "./analyticsService";
import { logger } from "../utils/logger";

interface BulkEmailInput {
  senderId: string;
  recipients: { name: string; email: string }[];
  subject: string;
  content: string;
  bulletPoints?: string[];
  attachments?: any[];
  scheduleDate?: string;
  batchSize?: number;
}

interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  errors: { email: string; error: string }[];
}

export async function sendBulkEmail(input: BulkEmailInput): Promise<BulkEmailResult> {
  const {
    senderId,
    recipients,
    subject,
    content,
    bulletPoints = [],
    attachments = [],
    scheduleDate,
    batchSize = 10,
  } = input;

  const results: BulkEmailResult = {
    total: recipients.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (recipient) => {
      try {
        const personalizedContent = content
          .replace(/{name}/g, recipient.name)
          .replace(/{email}/g, recipient.email);

        const email = await createEmail({
          senderId,
          recipients: [recipient],
          subject: subject.replace(/{name}/g, recipient.name),
          content: personalizedContent,
          bulletPoints,
          attachments,
          status: scheduleDate ? "draft" : "sent",
          sentAt: scheduleDate ? undefined : new Date().toISOString(),
        });

        await trackEvent(senderId, "email_sent");

        results.sent++;
        return { success: true, recipient };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: errorMessage,
        });
        logger.error({ error, recipient }, "Failed to send bulk email");
        return { success: false, recipient, error: errorMessage };
      }
    });

    await Promise.all(batchPromises);
  }

  logger.info({
    senderId,
    total: results.total,
    sent: results.sent,
    failed: results.failed,
  }, "Bulk email sending completed");

  return results;
}

export async function scheduleBulkEmail(input: BulkEmailInput): Promise<{
  id: string;
  total: number;
  scheduledAt: string;
}> {
  const { senderId, recipients, subject, content, bulletPoints, attachments, scheduleDate } = input;

  if (!scheduleDate) {
    throw new Error("Schedule date is required for scheduled bulk emails");
  }

  // ✅ Check if table exists, if not, log error and throw
  try {
    const { data, error } = await supabase
      .from("BulkEmailJob")
      .insert({
        senderId,
        recipients,
        subject,
        content,
        bulletPoints: bulletPoints || [],
        attachments: attachments || [],
        scheduleDate,
        status: "scheduled",
        totalCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, input }, "Failed to schedule bulk email - table may not exist");
      throw new Error(`Failed to schedule bulk email: ${error.message}`);
    }

    return {
      id: data.id,
      total: recipients.length,
      scheduledAt: scheduleDate,
    };
  } catch (error) {
    logger.error({ error, input }, "Bulk email scheduling failed");
    throw error;
  }
}

export async function processScheduledBulkEmails(): Promise<void> {
  const now = new Date().toISOString();

  try {
    const { data: jobs, error } = await supabase
      .from("BulkEmailJob")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduleDate", now);

    if (error) {
      logger.error({ error }, "Failed to fetch scheduled bulk emails");
      return;
    }

    for (const job of jobs) {
      try {
        await supabase
          .from("BulkEmailJob")
          .update({ status: "processing", startedAt: now })
          .eq("id", job.id);

        const result = await sendBulkEmail({
          senderId: job.senderId,
          recipients: job.recipients,
          subject: job.subject,
          content: job.content,
          bulletPoints: job.bulletPoints || [],
          attachments: job.attachments || [],
        });

        await supabase
          .from("BulkEmailJob")
          .update({
            status: result.failed === 0 ? "completed" : "partial",
            sentCount: result.sent,
            failedCount: result.failed,
            completedAt: new Date().toISOString(),
            errors: result.errors,
          })
          .eq("id", job.id);

        logger.info({ jobId: job.id, ...result }, "Bulk email job completed");
      } catch (error) {
        logger.error({ error, jobId: job.id }, "Bulk email job failed");
        
        await supabase
          .from("BulkEmailJob")
          .update({
            status: "failed",
            errors: [{ error: error instanceof Error ? error.message : "Unknown error" }],
            completedAt: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to process scheduled bulk emails");
  }
}