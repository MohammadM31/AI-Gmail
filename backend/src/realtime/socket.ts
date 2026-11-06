import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";
import { readCookieHeader, sessionKnown } from "../utils/jwt";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      readCookieHeader(socket.handshake.headers.cookie, "app_session");
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, secret) as {
        sub: string;
        organizationId: string;
        sid?: string;
      };
      if (payload.sid && sessionKnown(payload.sid) === false) return next(new Error("Unauthorized"));
      socket.data.userId = payload.sub;
      socket.data.organizationId = payload.organizationId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const room = `org:${socket.data.organizationId}`;
    socket.join(room);
    socket.join(`user:${socket.data.userId}`);
    logger.debug({ userId: socket.data.userId, room }, "socket connected");

    socket.on("disconnect", () => {
      logger.debug({ userId: socket.data.userId }, "socket disconnected");
    });
  });

  return io;
}

export function getIo() {
  return io;
}
