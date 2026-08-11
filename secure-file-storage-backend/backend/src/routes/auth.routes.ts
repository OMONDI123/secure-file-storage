import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * Rate limiter for authentication endpoints.
 * Protects against brute force and credential stuffing attacks.
 * Allows 20 attempts per 15-minute window.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Please try again later." } },
});

/**
 * Public Authentication Routes
 * No authentication required to access these endpoints.
 */
router.post(
  "/register",
  authLimiter,
  validateBody(authController.registerSchema),
  authController.register
);

router.post(
  "/login",
  authLimiter,
  validateBody(authController.loginSchema),
  authController.login
);

router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

/**
 * Protected Route
 * Requires valid JWT access token.
 * Returns the authenticated user's profile.
 */
router.get("/me", requireAuth, authController.me);

export default router;