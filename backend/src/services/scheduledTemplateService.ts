import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

/**
 * Background service that checks for scheduled templates and sends them.
 * Should be called periodically via cron job or setInterval.
 * 
 * Usage:
 * - In server.ts: 
 *   import { startScheduledTemplateService } from "./services/scheduledTemplateService";
 *   startScheduledTemplateService(60 * 60 * 1000); // Check every hour
 */

let isRunning = false;

export async function checkAndSendScheduledTemplates() {
  if (isRunning) {
    logger.info("⏳ Scheduled template check already running, skipping...");
    return;
  }

  isRunning = true;
  try {
    const now = new Date();
    logger.info("🔍 Checking for scheduled templates due at:", now.toISOString());

    // Find templates that are due for sending
    const { data: templates, error } = await supabase
      .from("Template")
      .select("*, Contact!recipientId(name, email)")
      .eq("autoSend", true)
      .eq("isScheduled", true)
      .lte("scheduleDate", now.toISOString())
      .is("lastSentAt", null);

    if (error) {
      logger.error("Failed to fetch scheduled templates:", error);
      return;
    }

    if (!templates || templates.length === 0) {
      logger.info("✅ No scheduled templates due");
      return;
    }

    logger.info(`📧 Found ${templates.length} scheduled template(s) to send`);

    const results = [];
    for (const template of templates) {
      try {
        const contactName = template.Contact?.name || "Recipient";
        const resolvedPrompt = template.prompt.replace(/{contact}/g, contactName);

        // Create and send email
        const { error: insertError } = await supabase
          .from("Email")
          .insert({
            senderId: template.userId,
            recipients: [{ 
              name: template.Contact?.name || "Recipient", 
              email: template.Contact?.email || null 
            }],
            subject: `Automated: ${template.name}`,
            content: resolvedPrompt,
            bulletPoints: ["This email was sent automatically from a template."],
            chartData: null,
            attachments: [],
            status: "sent",
            threadId: crypto.randomUUID(),
            sentAt: now.toISOString(),
          });

        if (insertError) {
          logger.error(`Failed to send scheduled template ${template.id}:`, insertError);
          results.push({ id: template.id, success: false, error: insertError.message });
          continue;
        }

        // Mark template as sent
        await supabase
          .from("Template")
          .update({ 
            lastSentAt: now.toISOString(),
            usageCount: (template.usageCount || 0) + 1
          })
          .eq("id", template.id);

        logger.info(`✅ Sent scheduled template ${template.id} to ${contactName}`);
        results.push({ id: template.id, success: true });

      } catch (err) {
        logger.error(`Failed to process template ${template.id}:`, err);
        results.push({ id: template.id, success: false, error: (err as Error).message });
      }
    }

    logger.info(`📊 Scheduled template check complete. Sent: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
    return results;

  } catch (err) {
    logger.error("Scheduled template service error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled template service with a given interval (in milliseconds).
 * Default: every hour (60 * 60 * 1000)
 */
export function startScheduledTemplateService(interval: number = 60 * 60 * 1000) {
  logger.info(`⏰ Starting scheduled template service (interval: ${interval}ms)`);
  
  // Run immediately on start
  checkAndSendScheduledTemplates();
  
  // Then run on interval
  const timer = setInterval(checkAndSendScheduledTemplates, interval);
  
  // Return the timer so it can be cleared if needed
  return timer;
}

/**
 * Stop the scheduled template service
 */
export function stopScheduledTemplateService(timer: NodeJS.Timeout) {
  clearInterval(timer);
  logger.info("⏹️ Scheduled template service stopped");
}