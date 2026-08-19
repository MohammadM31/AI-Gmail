import { NextFunction, Request, Response } from "express";
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
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error";

  logger.error({ err, path: req.path }, "request failed");

  res.status(status).json({
    error: { message: status === 500 ? "Internal server error" : message },
  });
}
