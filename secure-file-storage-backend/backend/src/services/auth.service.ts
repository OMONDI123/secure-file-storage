import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { PublicUser, User } from "../types";
import { env } from "../config/env";

const SALT_ROUNDS = 12;

/**
 * Converts a full User object to a PublicUser object, excluding sensitive fields.
 */
function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Hashes a token using SHA-256 for secure storage.
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Calculates the expiration date for a refresh token based on environment configuration.
 * Supports durations like "7d", "15m", "1h", "30s".
 */
function refreshExpiryDate(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const amount = match ? parseInt(match[1], 10) : 7;
  const unit = match ? match[2] : "d";
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + amount * (multipliers[unit] || 86400000));
}

/**
 * Registers a new user account.
 * - Validates email uniqueness
 * - Hashes password before storage
 * - Issues initial session tokens
 */
export async function register(email: string, password: string, name: string) {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await pool.query<User>(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *`,
    [email.toLowerCase(), passwordHash, name]
  );
  const user = result.rows[0];
  return issueSession(user);
}

/**
 * Authenticates a user and issues session tokens.
 * - Verifies email exists and password matches
 * - Throws generic error for security (prevents user enumeration)
 */
export async function login(email: string, password: string) {
  const result = await pool.query<User>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Update last login timestamp
  await pool.query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);

  return issueSession(user);
}

/**
 * Issues a new access and refresh token pair for a user.
 * - Stores refresh token hash in database for validation
 * - Enables token rotation on refresh
 */
async function issueSession(user: User) {
  const payload = { sub: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), refreshExpiryDate()]
  );

  return { user: toPublicUser(user), accessToken, refreshToken };
}

/**
 * Refreshes an existing session using a valid refresh token.
 * - Implements token rotation: revokes the used token and issues a new pair
 * - Verifies token exists, is not revoked, and is not expired
 */
export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const result = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND revoked = false AND expires_at > now()`,
    [tokenHash, payload.sub]
  );
  if (result.rowCount === 0) {
    throw ApiError.unauthorized("Refresh token not recognized or has been revoked");
  }

  // Revoke the used token (token rotation)
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [tokenHash]);

  const userResult = await pool.query<User>("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = userResult.rows[0];
  if (!user) {
    throw ApiError.unauthorized("User no longer exists");
  }

  return issueSession(user);
}

/**
 * Logs out a user by revoking their refresh token.
 */
export async function logout(refreshToken: string) {
  if (!refreshToken) {
    return; // No token to revoke
  }
  const tokenHash = hashToken(refreshToken);
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [tokenHash]);
}

/**
 * Retrieves a public user profile by ID.
 * - Throws an error if the user does not exist
 */
export async function getUserById(id: string): Promise<PublicUser> {
  const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [id]);
  const user = result.rows[0];
  if (!user) throw ApiError.notFound("User not found");
  return toPublicUser(user);
}

/**
 * Revokes all refresh tokens for a user (force logout from all devices).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
    [userId]
  );
}

/**
 * Gets the current user's full profile (for authenticated routes).
 */
export async function getFullUserById(id: string): Promise<User> {
  const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [id]);
  const user = result.rows[0];
  if (!user) throw ApiError.notFound("User not found");
  return user;
}