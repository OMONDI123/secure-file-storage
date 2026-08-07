import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details ?? undefined },
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File exceeds the maximum allowed size of ${env.MAX_FILE_SIZE_MB}MB`
        : err.message;
    return res.status(400).json({ error: { message } });
  }

  console.error("Unhandled error:", err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return res.status(500).json({
    error: { message: env.NODE_ENV === "production" ? "Internal server error" : message },
  });
}
