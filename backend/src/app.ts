// backend/src/app.ts

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { validateEnvironment } from "./config/env";

import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import emailRoutes from "./routes/emailRoutes";
import contactRoutes from "./routes/contactRoutes";
import templateRoutes from "./routes/templateRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import pipelineRoutes from "./routes/pipelineRoutes";
import requirementsRoutes from "./routes/requirementsRoutes";
import sprintRoutes from "./routes/sprintRoutes";
import clientProjectRoutes from "./routes/clientProjectRoutes";
import mailboxRoutes from "./routes/mailboxRoutes";
import mailWebhookRoutes from "./routes/mailWebhookRoutes";

validateEnvironment();

export const app =
  express();

// Render sits one proxy hop in front of the app. Without this, every
// rate-limit bucket is the proxy IP.
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    crossOriginOpenerPolicy: {
      policy: "unsafe-none",
    },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:",
        ],

        connectSrc: [
          "'self'",
          process.env.SUPABASE_URL ||
            "",
          "https://api.openai.com",
        ].filter(Boolean),

        fontSrc: [
          "'self'",
          "data:",
        ],

        objectSrc: ["'none'"],

        frameSrc: ["'none'"],

        baseUri: ["'self'"],

        formAction: ["'self'"],

        upgradeInsecureRequests: [],
      },
    },

    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

const getCorsOrigins =
  (): (string | RegExp)[] => {
    const origins: (
      | string
      | RegExp
    )[] = [];

    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      origins.push(
        /^http:\/\/localhost:\d+$/
      );

      origins.push(
        /^http:\/\/127\.0\.0\.1:\d+$/
      );
    }

    const frontendUrl =
      process.env.FRONTEND_URL;

    if (frontendUrl) {
      origins.push(
        frontendUrl
      );
    }

    if (
      process.env
        .ADDITIONAL_CORS_ORIGINS
    ) {
      try {
        const additional =
          JSON.parse(
            process.env
              .ADDITIONAL_CORS_ORIGINS
          );

        if (
          Array.isArray(
            additional
          )
        ) {
          origins.push(
            ...additional
          );
        }
      } catch {
        logger.warn(
          "Failed to parse ADDITIONAL_CORS_ORIGINS"
        );
      }
    }

    const backendUrl =
      process.env.BACKEND_URL;

    if (backendUrl) {
      origins.push(
        backendUrl
      );
    }

    return origins.filter(
      Boolean
    );
  };

const allowedOrigins =
  getCorsOrigins();

logger.info(
  {
    allowedOrigins,
  },
  "CORS origins configured"
);

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const isAllowed =
        allowedOrigins.some(
          (
            allowedOrigin
          ) => {
            if (
              allowedOrigin instanceof
              RegExp
            ) {
              return allowedOrigin.test(
                origin
              );
            }

            return (
              allowedOrigin ===
              origin
            );
          }
        );

      if (isAllowed) {
        logger.debug(
          { origin },
          "CORS allowed"
        );

        callback(
          null,
          true
        );
      } else {
        logger.warn(
          {
            origin,
            allowedOrigins,
          },
          "CORS blocked"
        );

        callback(
          new Error(
            "Not allowed by CORS"
          )
        );
      }
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
      "PATCH",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
      "X-CSRF-Token",
    ],

    exposedHeaders: [
      "Content-Length",
      "X-Request-Id",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],

    maxAge: 86400,

    preflightContinue: false,

    optionsSuccessStatus: 204,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.use(
  pinoHttp({
    logger,

    serializers: {
      req: (req) => ({
        method: req.method,

        url: req.url,

        headers: {
          "user-agent":
            req.headers[
              "user-agent"
            ],

          "x-request-id":
            req.headers[
              "x-request-id"
            ],
        },
      }),
    },
  })
);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-email-backend",
    health: "/health",
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get(
  "/health",
  (_req, res) => {
    res.json({
      status: "ok",

      timestamp:
        new Date().toISOString(),

      environment:
        process.env.NODE_ENV,
    });
  }
);

// ============================================================
// API ROUTES
// ============================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/emails",
  emailRoutes
);

app.use(
  "/api/contacts",
  contactRoutes
);

app.use(
  "/api/templates",
  templateRoutes
);

app.use(
  "/api/analytics",
  analyticsRoutes
);

app.use(
  "/api/users/settings",
  settingsRoutes
);

app.use(
  "/api/pipeline",
  pipelineRoutes
);

app.use(
  "/api/requirements",
  requirementsRoutes
);

app.use(
  "/api/sprints",
  sprintRoutes
);

app.use(
  "/api/client-projects",
  clientProjectRoutes
);

app.use(
  "/api/mailbox",
  mailboxRoutes
);

app.use(
  "/api/mail",
  mailWebhookRoutes
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  errorHandler
);
