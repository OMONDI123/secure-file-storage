// middleware/upload.ts
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";
import { env } from "../config/env";

/**
 * OWASP File Upload Cheat Sheet guidance applied here:
 * - Files are stored outside any web-servable/static directory.
 * - The original filename is NEVER used to build the on-disk path (stored_name is a UUID).
 * - Extension + MIME type are checked against an allowlist (denylists are bypassable).
 * - A hard size cap is enforced by multer itself (belt-and-suspenders with app-level checks).
 * - Double extensions (e.g. "file.php.png") are rejected.
 */

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
  ".pdf", ".txt", ".csv", ".md", ".rtf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".avi", ".mkv", ".webm",
  ".json", ".xml", ".yaml", ".yml",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/json",
  "application/xml",
  "application/octet-stream",
]);

function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split(".");
  if (parts.length <= 2) return false;
  const dangerous = new Set(["php", "phtml", "asp", "aspx", "jsp", "exe", "sh", "bat", "cmd", "js", "vbs", "ps1"]);
  return parts.slice(1, -1).some((p) => dangerous.has(p.toLowerCase()));
}

function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

// For S3, use memory storage. For local, use disk storage.
const storage = env.STORAGE_TYPE === 's3' 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(env.STORAGE_DIR)) {
          fs.mkdirSync(env.STORAGE_DIR, { recursive: true });
        }
        cb(null, env.STORAGE_DIR);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "";
        cb(null, `${uuidv4()}${safeExt}`);
      },
    });

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (hasDoubleExtension(file.originalname)) {
    return cb(new Error("Filename contains a disallowed double extension"));
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension "${ext}" is not allowed`));
  }
  if (!isAllowedMime(file.mimetype)) {
    return cb(new Error(`File type "${file.mimetype}" is not allowed`));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});
