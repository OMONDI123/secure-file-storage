import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Middleware factory that validates request body against a Zod schema.
 * On validation success, replaces `req.body` with the validated data.
 * On validation failure, returns a 400 Bad Request error with detailed validation errors.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(ApiError.badRequest("Validation failed", err.flatten()));
      }
      next(err);
    }
  };
}