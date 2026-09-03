// backend/src/services/scheduledTemplateService.ts
import crypto from "crypto"; // ✅ ADDED
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

let isRunning = false;

export async function checkAndSendScheduledTemplates() {
  if (isRunning) {
    logger.info("⏳ Scheduled template check already running, skipping...");
    return;
  }

  isRunning = true;
  try {
    const now = new Date();
    logger.info(`🔍 Checking for scheduled templates due at: ${now.toISOString()}`);

    const { data: templates, error } = await supabase
      .from("Template")
      .select("*, Contact!recipientId(name, email)")
      .eq("autoSend", true)
      .eq("isScheduled", true)
      .lte("scheduleDate", now.toISOString())
      .is("lastSentAt", null);

    if (error) {
      logger.error(`Failed to fetch scheduled templates: ${error.message}`);
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
            threadId: crypto.randomUUID(), // ✅ Now works with import
            sentAt: now.toISOString(),
          });

        if (insertError) {
          logger.error(`Failed to send scheduled template ${template.id}: ${insertError.message}`);
          results.push({ id: template.id, success: false, error: insertError.message });
          continue;
        }

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
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to process template ${template.id}: ${errorMsg}`);
        results.push({ id: template.id, success: false, error: errorMsg });
      }
    }

    logger.info(`📊 Scheduled template check complete. Sent: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
    return results;

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Scheduled template service error: ${errorMsg}`);
  } finally {
    isRunning = false;
  }
}

export function startScheduledTemplateService(interval: number = 60 * 60 * 1000) {
  logger.info(`⏰ Starting scheduled template service (interval: ${interval}ms)`);
  checkAndSendScheduledTemplates();
  const timer = setInterval(checkAndSendScheduledTemplates, interval);
  return timer;
}

export function stopScheduledTemplateService(timer: NodeJS.Timeout) {
  clearInterval(timer);
  logger.info("⏹️ Scheduled template service stopped");
}