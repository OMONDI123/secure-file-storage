import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * Populates req.user with { sub, email } on success.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

/**
 * Attaches req.user if a valid token is present, but does not fail
 * the request if it's missing. Used for endpoints that behave
 * differently for authenticated vs anonymous users (e.g. public file view).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}
