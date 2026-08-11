import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  // App
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // JWT
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Storage Configuration
  STORAGE_TYPE: (process.env.STORAGE_TYPE || "local") as "local" | "s3",
  
  // Local Storage (used when STORAGE_TYPE === "local")
  STORAGE_DIR: path.resolve(process.env.STORAGE_DIR || "./storage"),
  
  // S3 Storage (used when STORAGE_TYPE === "s3")
  AWS_ACCESS_KEY_ID: optional("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: optional("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: optional("AWS_REGION", "us-east-1"),
  S3_BUCKET_NAME: optional("S3_BUCKET_NAME"),
  AWS_S3_ENDPOINT: optional("AWS_S3_ENDPOINT"), // For custom S3 endpoints (DigitalOcean Spaces, etc.)
  
  // File limits
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || "120", 10),
  
  // Presigned URL expiration (in seconds)
  PUBLIC_FILE_EXPIRY: parseInt(process.env.PUBLIC_FILE_EXPIRY || "3600", 10), // 1 hour
  PRIVATE_FILE_EXPIRY: parseInt(process.env.PRIVATE_FILE_EXPIRY || "300", 10), // 5 minutes
};

// Validation: If using S3, ensure all S3 credentials are present
if (env.STORAGE_TYPE === "s3") {
  if (!env.AWS_ACCESS_KEY_ID) {
    throw new Error("Missing required environment variable: AWS_ACCESS_KEY_ID (required when STORAGE_TYPE=s3)");
  }
  if (!env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Missing required environment variable: AWS_SECRET_ACCESS_KEY (required when STORAGE_TYPE=s3)");
  }
  if (!env.S3_BUCKET_NAME) {
    throw new Error("Missing required environment variable: S3_BUCKET_NAME (required when STORAGE_TYPE=s3)");
  }
}

// Validation: If using local storage, ensure STORAGE_DIR is valid
if (env.STORAGE_TYPE === "local") {
  // Create directory if it doesn't exist (will be handled by storage service)
  // Just log a warning if it's not set
  if (!env.STORAGE_DIR) {
    console.warn("STORAGE_DIR not set, using default: ./storage");
  }
}

// Validation: Max file size
if (env.MAX_FILE_SIZE_MB <= 0) {
  throw new Error("MAX_FILE_SIZE_MB must be greater than 0");
}

// Export type for use in other files
export type Env = typeof env;
