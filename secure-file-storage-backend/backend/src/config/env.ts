import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config();

/**
 * Validates and retrieves a required environment variable
 * @param name - The environment variable name
 * @param fallback - Optional fallback value if not set
 * @throws Error if the variable is not set and no fallback provided
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Environment configuration object
 * Contains all application configuration derived from environment variables
 */
export const env = {
  // Application environment
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // Server configuration
  PORT: parseInt(process.env.PORT || "4000", 10),
  
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

  // File storage configuration (now used as S3 key prefix)
  STORAGE_DIR: process.env.STORAGE_DIR || "uploads",
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || "120", 10),
};

// Validation for critical configuration
if (env.NODE_ENV === "production") {
  if (!env.CLIENT_ORIGIN || env.CLIENT_ORIGIN === "http://localhost:5173") {
    console.warn("[Warning] CLIENT_ORIGIN is set to localhost in production environment");
  }
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
