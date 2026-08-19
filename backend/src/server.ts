import http from "http";
import { app } from "./app";
import { initSocket } from "./realtime/socket";
import { logger } from "./utils/logger";

const httpServer = http.createServer(app);
initSocket(httpServer);

const PORT = Number(process.env.PORT ?? 5000);
httpServer.listen(PORT, () => {
  logger.info(`Backend listening on http://localhost:${PORT}`);
});
