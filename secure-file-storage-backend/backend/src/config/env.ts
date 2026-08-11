import dotenv from "dotenv";
import path from "path";

dotenv.config();

/**
 * Type-safe environment variable getter
 */
function getEnv<T extends string | number>(
  name: string,
  fallback: T,
  parser?: (value: string) => T
): T {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return parser ? parser(value) : (value as T);
}

/**
 * Validates required environment variables
 */
function validateEnv(variables: string[]): void {
  const missing = variables.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// Validate required variables early
validateEnv(["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]);

/**
 * Application environment configuration
 */
export const env = {
  // Environment
  NODE_ENV: getEnv("NODE_ENV", "development") as string,

  // Server
  PORT: getEnv("PORT", 4000, (v) => parseInt(v, 10)),

  // CORS
  CLIENT_ORIGIN: getEnv("CLIENT_ORIGIN", "http://localhost:5173") as string,

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_ACCESS_EXPIRES_IN: getEnv("JWT_ACCESS_EXPIRES_IN", "15m") as string,
  JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "7d") as string,

  // Storage
  STORAGE_DIR: path.resolve(getEnv("STORAGE_DIR", "./storage") as string),
  MAX_FILE_SIZE_MB: getEnv("MAX_FILE_SIZE_MB", 120, (v) => parseInt(v, 10)),
} as const;

// Log configuration in development
if (env.NODE_ENV !== "production") {
  console.log("[Config] Environment loaded successfully");
  console.log("[Config] NODE_ENV:", env.NODE_ENV);
  console.log("[Config] PORT:", env.PORT);
  console.log("[Config] CLIENT_ORIGIN:", env.CLIENT_ORIGIN);
}
