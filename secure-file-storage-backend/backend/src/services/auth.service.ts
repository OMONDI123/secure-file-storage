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
  console.log('[Auth] Register attempt for:', email);
  
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  console.log('[Auth] Password hashed successfully');
  
  const result = await pool.query<User>(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *`,
    [email.toLowerCase(), passwordHash, name]
  );
  const user = result.rows[0];
  console.log('[Auth] User registered:', user.id);
  
  return issueSession(user);
}

/**
 * Authenticates a user and issues session tokens.
 * - Verifies email exists and password matches
 * - Throws generic error for security (prevents user enumeration)
 */
export async function login(email: string, password: string) {
  console.log('[Auth] Login attempt for:', email);
  
  try {
    // Step 1: Find user
    const result = await pool.query<User>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];
    
    if (!user) {
      console.log('[Auth] User not found:', email);
      throw ApiError.unauthorized("Invalid email or password");
    }

    console.log('[Auth] User found:', user.id);
    console.log('[Auth] Password hash exists:', !!user.password_hash);

    // Step 2: Verify password
    try {
      const valid = await bcrypt.compare(password, user.password_hash);
      console.log('[Auth] Password match:', valid);
      
      if (!valid) {
        throw ApiError.unauthorized("Invalid email or password");
      }
    } catch (bcryptError) {
      console.error('[Auth] Bcrypt error:', bcryptError);
      throw ApiError.internal("Password verification failed");
    }

    // Step 3: Update last login timestamp
    try {
      await pool.query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);
      console.log('[Auth] Last login updated');
    } catch (updateError) {
      console.warn('[Auth] Failed to update last_login:', updateError);
      // Non-critical, continue
    }

    // Step 4: Issue session
    const session = await issueSession(user);
    console.log('[Auth] Login successful for:', user.email);
    return session;
    
  } catch (error) {
    console.error('[Auth] Login error:', error);
    throw error;
  }
}

/**
 * Issues a new access and refresh token pair for a user.
 * - Stores refresh token hash in database for validation
 * - Enables token rotation on refresh
 */
async function issueSession(user: User) {
  console.log('[Auth] Issuing session for user:', user.id);
  
  try {
    const payload = { sub: user.id, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    console.log('[Auth] Tokens signed successfully');

    const tokenHash = hashToken(refreshToken);
    console.log('[Auth] Refresh token hashed');

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, refreshExpiryDate()]
    );
    console.log('[Auth] Refresh token stored in database');

    return { user: toPublicUser(user), accessToken, refreshToken };
  } catch (error) {
    console.error('[Auth] Error issuing session:', error);
    throw ApiError.internal("Failed to issue session");
  }
}

/**
 * Refreshes an existing session using a valid refresh token.
 * - Implements token rotation: revokes the used token and issues a new pair
 * - Verifies token exists, is not revoked, and is not expired
 */
export async function refreshSession(refreshToken: string) {
  console.log('[Auth] Refresh attempt');
  
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
    console.log('[Auth] Refresh token verified for user:', payload.sub);
  } catch (error) {
    console.log('[Auth] Invalid refresh token');
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const result = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND revoked = false AND expires_at > now()`,
    [tokenHash, payload.sub]
  );
  if (result.rowCount === 0) {
    console.log('[Auth] Refresh token not found or revoked');
    throw ApiError.unauthorized("Refresh token not recognized or has been revoked");
  }

  // Revoke the used token (token rotation)
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [tokenHash]);
  console.log('[Auth] Old refresh token revoked');

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
  console.log('[Auth] Logout successful');
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
  console.log('[Auth] All sessions revoked for user:', userId);
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