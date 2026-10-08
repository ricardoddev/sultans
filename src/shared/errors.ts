import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { z } from "zod";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function isInvalidJson(error: unknown): boolean {
  return (error as { type?: unknown } | null)?.type === "entity.parse.failed";
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError("NOT_FOUND", `Route ${req.method} ${req.path} not found`, 404);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) console.error(error);
    sendError(res, error.status, error.code, error.message);
  } else if (error instanceof z.ZodError) {
    sendError(res, 400, "VALIDATION_ERROR", z.prettifyError(error));
  } else if (isInvalidJson(error)) {
    sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
  } else {
    console.error(error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
};
