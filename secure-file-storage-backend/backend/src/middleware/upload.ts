// middleware/upload.ts
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
import multerS3 from "multer-s3";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";
import { env } from "../config/env";
import { s3Client } from "../config/s3";

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

// Helper to get content type based on file extension
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
    '.rtf': 'application/rtf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/x-rar-compressed',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Configure storage based on environment
let storage: any;

if (env.STORAGE_TYPE === 's3') {
  console.log('[Upload] Configuring S3 storage...');
  storage = multerS3({
    s3: s3Client,
    bucket: env.AWS_S3_BUCKET_NAME,
    acl: 'private',
    contentType: (req: any, file: any, cb: (err: any, mime?: string) => void) => {
      const mime = getContentType(file.originalname);
      console.log(`[Upload] Detected MIME type: ${mime} for ${file.originalname}`);
      cb(null, mime);
    },
    key: (req: any, file: any, cb: (err: any, key?: string) => void) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
      const uniqueId = uuidv4();
      const key = `uploads/${uniqueId}${safeExt}`;
      console.log(`[Upload] Generated S3 key: ${key}`);
      cb(null, key);
    },
  });
} else {
  console.log('[Upload] Configuring local storage...');
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(env.STORAGE_DIR)) {
        fs.mkdirSync(env.STORAGE_DIR, { recursive: true });
        console.log(`[Upload] Created storage directory: ${env.STORAGE_DIR}`);
      }
      cb(null, env.STORAGE_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "";
      const filename = `${uuidv4()}${safeExt}`;
      console.log(`[Upload] Generated local filename: ${filename}`);
      cb(null, filename);
    },
  });
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (hasDoubleExtension(file.originalname)) {
    console.warn(`[Upload] Rejected double extension: ${file.originalname}`);
    return cb(new Error("Filename contains a disallowed double extension"));
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    console.warn(`[Upload] Rejected extension: ${ext} for ${file.originalname}`);
    return cb(new Error(`File extension "${ext}" is not allowed`));
  }
  if (!isAllowedMime(file.mimetype)) {
    console.warn(`[Upload] Rejected MIME type: ${file.mimetype} for ${file.originalname}`);
    return cb(new Error(`File type "${file.mimetype}" is not allowed`));
  }
  console.log(`[Upload] File accepted: ${file.originalname} (${file.mimetype})`);
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

// Export the S3 file type for use in controllers
export interface MulterS3File extends Express.Multer.File {
  key: string;
  location?: string;
  etag?: string;
  bucket?: string;
}