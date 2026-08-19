import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import emailRoutes from "./routes/emailRoutes";
import contactRoutes from "./routes/contactRoutes";
import templateRoutes from "./routes/templateRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import settingsRoutes from "./routes/settingsRoutes";

export const app = express();

app.use(helmet());

// ✅ FIXED: Handle both with and without trailing slash
const allowedOrigins = [
  "https://ai-gmail-three.vercel.app",
  "https://ai-gmail-three.vercel.app/",
  process.env.FRONTEND_URL ?? "http://localhost:5173"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Check if the origin is allowed
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('❌ CORS blocked origin:', origin);
        console.log('✅ Allowed origins:', allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users/settings", settingsRoutes);

app.use(errorHandler);