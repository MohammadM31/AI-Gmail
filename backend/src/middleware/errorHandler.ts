import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // ✅ LOG THE FULL ERROR DETAILS
  console.error("❌ ERROR HANDLER TRIGGERED");
  console.error("❌ Error type:", typeof err);
  console.error("❌ Error value:", err);

  if (err instanceof Error) {
    console.error("❌ Error message:", err.message);
    console.error("❌ Error stack:", err.stack);
  }

  // A zod .parse() failure (invalid request body) is a client error,
  // not a server error — every validated route (contacts, emails,
  // register, settings, templates) was mapping these to 500 because
  // ZodError isn't an ApiError, which meant "bad input" and "server
  // broke" were indistinguishable to the frontend and looked like
  // "the API is failing" for something as simple as a malformed email.
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    logger.error({ err, path: req.path, method: req.method, status: 400 }, "request failed validation");
    res.status(400).json({ error: { message } });
    return;
  }

  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error";

  // Log to pino as well
  logger.error({
    err,
    path: req.path,
    method: req.method,
    body: req.body,
    status
  }, "request failed");

  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error" : message,
      // ✅ Include error details in development
      ...(process.env.NODE_ENV !== "production" && err instanceof Error && {
        details: err.message,
        stack: err.stack
      })
    },
  });
}