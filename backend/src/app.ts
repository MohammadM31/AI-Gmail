// backend/src/app.ts
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

// ✅ HELMET should be BEFORE CORS but configured to allow CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  })
);

// ✅ FIXED CORS: Allow all Vercel origins and localhost
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "https://ai-gmail-lhnzwenxs-mohammadmoghnieh5-7328s-projects.vercel.app",
  "https://ai-gmail-three.vercel.app",
  "https://ai-gmail.vercel.app",
  // ✅ Allow any vercel.app subdomain
  /\.vercel\.app$/,
  // ✅ Allow the Render backend itself
  "https://ai-gmail-lw6d.onrender.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log("✅ Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        console.log("✅ No origin, allowing");
        return callback(null, true);
      }
      
      // Check if the origin is allowed
      const allowed = allowedOrigins.some((allowedOrigin) => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return allowedOrigin === origin || allowedOrigin === origin + "/";
      });
      
      if (allowed) {
        console.log("✅ CORS allowed:", origin);
        callback(null, true);
      } else {
        console.log("❌ CORS blocked:", origin);
        console.log("✅ Allowed origins:", allowedOrigins);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400, // 24 hours
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