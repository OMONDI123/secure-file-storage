import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config();

/**
 * Validates and retrieves a required environment variable.
 * Throws an error if the variable is not set and no fallback is provided.
 * 
 * @param name - The environment variable name
 * @param fallback - Optional fallback value if not set
 * @returns The environment variable value
 * @throws Error if the variable is missing and no fallback is provided
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Parses a numeric environment variable with a fallback value.
 * 
 * @param name - The environment variable name
 * @param fallback - Default value if parsing fails or variable is missing
 * @returns The parsed integer value
 */
function parseNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Environment configuration object.
 * Contains all application configuration derived from environment variables.
 * Configuration is validated at startup to catch missing variables early.
 */
export const env = {
  // Application environment
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // Server configuration
  PORT: parseNumber("PORT", 4000),
  
  // CORS configuration
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  // Database configuration
  DATABASE_URL: required("DATABASE_URL"),

  // JWT Authentication configuration
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // AWS S3 Configuration
  AWS_ACCESS_KEY_ID: required("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: required("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: required("AWS_REGION"),
  AWS_S3_BUCKET_NAME: required("AWS_S3_BUCKET_NAME"),

  // File storage configuration
  STORAGE_DIR: process.env.STORAGE_DIR || "uploads",
  MAX_FILE_SIZE_MB: parseNumber("MAX_FILE_SIZE_MB", 120),
};

// Environment validation
if (env.NODE_ENV === "production") {
  // Production-specific validation
  if (!env.CLIENT_ORIGIN || env.CLIENT_ORIGIN === "http://localhost:5173") {
    console.warn("[Config Warning] CLIENT_ORIGIN is set to localhost in production environment");
  }

  // Ensure secure cookie settings for production
  if (!env.AWS_S3_BUCKET_NAME) {
    throw new Error("AWS_S3_BUCKET_NAME is required in production environment");
  }
}

// Log configuration on startup (development only)
if (env.NODE_ENV !== "production") {
  console.log("[Config] Environment loaded successfully");
  console.log(`[Config] NODE_ENV: ${env.NODE_ENV}`);
  console.log(`[Config] PORT: ${env.PORT}`);
  console.log(`[Config] CLIENT_ORIGIN: ${env.CLIENT_ORIGIN}`);
  console.log(`[Config] S3 Bucket: ${env.AWS_S3_BUCKET_NAME}`);
  console.log(`[Config] Max File Size: ${env.MAX_FILE_SIZE_MB}MB`);
}

// Export individual constants for convenience
export const {
  NODE_ENV,
  PORT,
  CLIENT_ORIGIN,
  DATABASE_URL,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
  STORAGE_DIR,
  MAX_FILE_SIZE_MB,
} = env;

// Export the env type for use in other files
export type Env = typeof env;