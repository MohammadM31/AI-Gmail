import http from "http";
import { app } from "./app";
import { initSocket } from "./realtime/socket";
import { logger } from "./utils/logger";
import { startScheduledTemplateService } from "./services/scheduledTemplateService";

const httpServer = http.createServer(app);
initSocket(httpServer);

const PORT = Number(process.env.PORT ?? 5000);
httpServer.listen(PORT, () => {
  logger.info(`Backend listening on http://localhost:${PORT}`);
  
  // ✅ Start the scheduled template service (checks every hour)
  // Only start in production or if explicitly enabled
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_SCHEDULED_TEMPLATES === "true") {
    startScheduledTemplateService(60 * 60 * 1000); // Every hour
    logger.info("⏰ Scheduled template service started");
  } else {
    logger.info("⏸️ Scheduled template service disabled (development mode)");
  }
});