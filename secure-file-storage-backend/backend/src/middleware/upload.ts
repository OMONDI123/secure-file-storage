import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";

/**
 * Allowed file extensions based on OWASP File Upload Cheat Sheet recommendations.
 * Prevents upload of executable or potentially dangerous file types.
 */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
  ".pdf", ".txt", ".csv", ".md", ".rtf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".avi", ".mkv", ".webm",
  ".json", ".xml", ".yaml", ".yml",
]);

/**
 * Allowed MIME types for uploaded files.
 * Uses both prefix matching (image/*, video/*) and exact matching for specific types.
 */
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

/**
 * Detects and rejects files with dangerous double extensions (e.g., "file.php.png").
 * Prevents file upload bypass attacks.
 */
function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split(".");
  if (parts.length <= 2) return false;
  const dangerous = new Set(["php", "phtml", "asp", "aspx", "jsp", "exe", "sh", "bat", "cmd", "js", "vbs", "ps1"]);
  return parts.slice(1, -1).some((p) => dangerous.has(p.toLowerCase()));
}

/**
 * Validates that the file's MIME type is allowed.
 */
function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

/**
 * S3 file interface for type safety.
 */
interface MulterS3File extends Express.Multer.File {
  key: string;
  location?: string;
  etag?: string;
  bucket?: string;
}

/**
 * S3 Storage Configuration.
 * Files are stored with a UUID-based name to prevent collisions and directory traversal.
 */
const s3Storage = multerS3({
  s3: s3Client,
  bucket: env.AWS_S3_BUCKET_NAME,
  acl: "private",
  contentType: (_req: any, file: any, cb: (err: any, mime?: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    cb(null, mime);
  },
  key: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, key?: string) => void
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
    const uniqueId = uuidv4();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    const key = `${env.STORAGE_DIR}/${uniqueId}${safeExt}`;
    cb(null, key);
  },
});

/**
 * File filter that validates file extensions and MIME types.
 * Rejects files with double extensions or disallowed types.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
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

/**
 * Multer upload configuration.
 * Uses S3 storage, file filter validation, and size limits from environment.
 */
export const upload = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

export type { MulterS3File };