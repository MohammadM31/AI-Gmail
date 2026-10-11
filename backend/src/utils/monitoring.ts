// backend/src/utils/monitoring.ts
import { logger } from "./logger";

export function initializeSentry(): void {
  logger.info("Sentry disabled locally (no DSN configured)");
}

export function sentryMiddleware(_app: any): void {
  // no-op
}

export function sentryErrorHandler(_app: any): void {
  // no-op
}

export function captureException(error: Error, context?: Record<string, any>): void {
  logger.error({ error, context }, "Error captured (Sentry not configured)");
}

export function captureMessage(
  message: string,
  _level: "info" | "warning" | "error" = "info"
): void {
  logger.info({ message }, "Message captured");
}

export function setUserContext(_userId: string, _email?: string): void {
  // no-op
}

export function clearUserContext(): void {
  // no-op
}