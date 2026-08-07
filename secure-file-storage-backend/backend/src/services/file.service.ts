import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { FileRecord } from "../types";

function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createFileRecord(params: {
  ownerId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  isPublic: boolean;
}): Promise<FileRecord> {
  const checksum = await computeChecksum(params.storagePath);
  const shareToken = params.isPublic ? generateShareToken() : null;

  const result = await pool.query<FileRecord>(
    `INSERT INTO files
      (owner_id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, is_public, share_token, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.ownerId,
      params.originalName,
      params.storedName,
      params.mimeType,
      params.sizeBytes,
      checksum,
      params.isPublic,
      shareToken,
      params.storagePath,
    ]
  );
  return result.rows[0];
}

export async function listUserFiles(ownerId: string): Promise<FileRecord[]> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return result.rows;
}

export async function getFileForOwner(fileId: string, ownerId: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");
  if (file.owner_id !== ownerId) throw ApiError.forbidden("You do not have access to this file");
  return file;
}

/**
 * Resolves a file for download/preview, enforcing authorization:
 * - Public files are accessible to anyone with the share token.
 * - Private files are only accessible to their authenticated owner.
 */
export async function getFileForAccess(fileId: string, requesterId: string | undefined): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");

  if (file.is_public) return file;

  if (!requesterId || requesterId !== file.owner_id) {
    throw ApiError.forbidden("This file is private");
  }
  return file;
}

export async function getFileByShareToken(shareToken: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE share_token = $1 AND is_public = true`,
    [shareToken]
  );
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("Shared file not found or is no longer public");
  return file;
}

export async function setVisibility(fileId: string, ownerId: string, isPublic: boolean): Promise<FileRecord> {
  const file = await getFileForOwner(fileId, ownerId);

  let shareToken = file.share_token;
  if (isPublic && !shareToken) {
    shareToken = generateShareToken();
  }
  if (!isPublic) {
    shareToken = null;
  }

  const result = await pool.query<FileRecord>(
    `UPDATE files SET is_public = $1, share_token = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [isPublic, shareToken, fileId]
  );
  return result.rows[0];
}

export async function deleteFile(fileId: string, ownerId: string): Promise<void> {
  const file = await getFileForOwner(fileId, ownerId);

  await pool.query(`DELETE FROM files WHERE id = $1`, [fileId]);

  // Best-effort disk cleanup; DB row is already gone, so a failure here
  // just leaves an orphaned file rather than corrupting state.
  fs.unlink(file.storage_path, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error(`Failed to remove file from disk: ${file.storage_path}`, err);
    }
  });
}

export function resolveStoragePath(storedName: string): string {
  return path.join(env.STORAGE_DIR, storedName);
}
