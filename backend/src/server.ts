// backend/src/server.ts
import http from "http";
import { app } from "./app";
import { initSocket } from "./realtime/socket";
import { logger } from "./utils/logger";
import { startScheduledTemplateService } from "./services/scheduledTemplateService";
import { startEmailClassifierCron } from "./services/emailClassifierService";
import { startRequirementsSweeper } from "./services/requirementsSweeper";

const httpServer = http.createServer(app);
initSocket(httpServer);

const PORT = Number(process.env.PORT ?? 5000);

httpServer.listen(PORT, () => {
  logger.info(`Backend listening on http://localhost:${PORT}`);

  // Scheduled template service (existing)
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_SCHEDULED_TEMPLATES === "true"
  ) {
    startScheduledTemplateService(60 * 60 * 1000);
    logger.info("⏰ Scheduled template service started");
  }

  // Email classifier for the sprint engine
  if (process.env.REQUIREMENTS_SWEEPER_ENABLED === "true") {
    const intervalMs = Number(
      process.env.CLASSIFIER_INTERVAL_MS ?? 15 * 60 * 1000
    );
    startEmailClassifierCron(intervalMs);
    logger.info({ intervalMs }, "📥 Email classifier cron started");

    // Weekly sprint sweeper
    const sweepMs = Number(
      process.env.SWEEPER_INTERVAL_MS ?? 60 * 60 * 1000
    );
    startRequirementsSweeper(sweepMs);
    logger.info({ sweepMs }, "🗓️ Requirements sweeper cron started");
  } else {
    logger.info(
      "⏸️ Sprint engine disabled (set REQUIREMENTS_SWEEPER_ENABLED=true)"
    );
  }
});