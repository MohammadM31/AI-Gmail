// backend/src/utils/monitoring.ts
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./logger";

// Initialize Sentry
export function initializeSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn("SENTRY_DSN not configured. Error monitoring disabled.");
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      nodeProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
    ],
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  });

  logger.info("Sentry initialized");
}

// Sentry middleware for Express
export function sentryMiddleware(app: any): void {
  initializeSentry();
  
  // Request handler must be first
  app.use(Sentry.Handlers.requestHandler());
  
  // Tracing handler
  app.use(Sentry.Handlers.tracingHandler());
}

// Error handler with Sentry
export function sentryErrorHandler(app: any): void {
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());
}

// Capture exceptions with context
export function captureException(error: Error, context?: Record<string, any>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext("Context", context);
      }
      Sentry.captureException(error);
    });
  } else {
    logger.error({ error, context }, "Error captured (Sentry not configured)");
  }
}

// Capture message
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

// Add user context
export function setUserContext(userId: string, email?: string): void {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser({ id: userId, email });
  }
}

// Remove user context
export function clearUserContext(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}