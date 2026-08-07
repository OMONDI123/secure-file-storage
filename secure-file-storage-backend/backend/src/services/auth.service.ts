import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { PublicUser, User } from "../types";
import { env } from "../config/env";

const SALT_ROUNDS = 12;

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiryDate(): Date {
  // Parse a simple "7d" / "15m" style duration used by JWT_REFRESH_EXPIRES_IN.
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const amount = match ? parseInt(match[1], 10) : 7;
  const unit = match ? match[2] : "d";
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + amount * (multipliers[unit] || 86400000));
}

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

  return issueSession(user);
}

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

  // Rotate: revoke the used token, issue a new pair.
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [tokenHash]);

  const userResult = await pool.query<User>("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = userResult.rows[0];
  if (!user) {
    throw ApiError.unauthorized("User no longer exists");
  }

  return issueSession(user);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, [tokenHash]);
}

export async function getUserById(id: string): Promise<PublicUser> {
  const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [id]);
  const user = result.rows[0];
  if (!user) throw ApiError.notFound("User not found");
  return toPublicUser(user);
}
