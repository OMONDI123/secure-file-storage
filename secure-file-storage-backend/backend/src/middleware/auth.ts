import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { AccessTokenPayload } from "../types";

/**
 * Middleware that requires a valid JWT access token.
 * Expects the token in the Authorization header as "Bearer <token>".
 * On success, populates `req.user` with the decoded token payload.
 * On failure, returns a 401 Unauthorized error.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = payload as AccessTokenPayload;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

/**
 * Middleware that optionally authenticates a request.
 * If a valid token is present, populates `req.user` with the decoded payload.
 * If the token is missing or invalid, the request continues without authentication.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    try {
      const payload = verifyAccessToken(token);
      req.user = payload as AccessTokenPayload;
    } catch {
    }
  }
  next();
}