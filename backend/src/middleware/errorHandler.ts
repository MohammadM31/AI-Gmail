// backend/src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  status: number;
  code?: string;
  
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

// Specific error types for better handling
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(401, message, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = "Insufficient permissions") {
    super(403, message, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Too many requests, please try again later") {
    super(429, message, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string) {
    super(503, `${service} service is temporarily unavailable`, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error with context
  const errorContext = {
    path: req.path,
    method: req.method,
    userId: req.auth?.userId,
    organizationId: req.auth?.organizationId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    logger.warn({ ...errorContext, errors: err.issues }, "Validation failed");
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: err.issues,
      },
    });
  }

  // Handle known API errors
  if (err instanceof ApiError) {
    logger.warn({ ...errorContext, error: err }, `API Error: ${err.code || "UNKNOWN"}`);
    return res.status(err.status).json({
      error: {
        code: err.code || "API_ERROR",
        message: err.message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      },
    });
  }

  // Handle specific third-party errors
  if (err instanceof Error) {
    // Check for Gemini/Google AI errors
    if (err.message.includes("GEMINI_API_KEY") || err.message.includes("Gemini")) {
      logger.error({ ...errorContext, error: err }, "AI Service error");
      return res.status(503).json({
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "AI service is temporarily unavailable. Please try again later.",
        },
      });
    }

    // Supabase errors
    if (err.message.includes("Supabase") || err.message.includes("supabase")) {
      logger.error({ ...errorContext, error: err }, "Database error");
      return res.status(500).json({
        error: {
          code: "DATABASE_ERROR",
          message: "A database error occurred. Please try again.",
        },
      });
    }
  }

  // Unknown/fallback error
  logger.error({ ...errorContext, error: err }, "Unhandled error");
  
  const isDevelopment = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isDevelopment && err instanceof Error ? err.message : "An unexpected error occurred",
      ...(isDevelopment && err instanceof Error && { stack: err.stack }),
    },
  });
}