import crypto from "crypto";
import { s3Client } from "../config/s3";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { FileRecord } from "../types";

function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Generate a pre-signed URL for S3 file access
 */
export async function generateSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: storagePath,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Create a new file record in the database
 */
export async function createFileRecord(params: {
  ownerId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  isPublic: boolean;
}): Promise<FileRecord> {
  const shareToken = params.isPublic ? generateShareToken() : null;

  const result = await pool.query<FileRecord>(
    `INSERT INTO files
      (owner_id, original_name, stored_name, mime_type, size_bytes, storage_path, is_public, share_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.ownerId,
      params.originalName,
      params.storedName,
      params.mimeType,
      params.sizeBytes,
      params.storagePath,
      params.isPublic,
      shareToken,
    ]
  );
  return result.rows[0];
}

/**
 * List all files owned by a user
 */
export async function listUserFiles(ownerId: string): Promise<FileRecord[]> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return result.rows;
}

/**
 * Get a file by ID for the owner
 */
export async function getFileForOwner(fileId: string, ownerId: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");
  if (file.owner_id !== ownerId) throw ApiError.forbidden("You do not have access to this file");
  return file;
}

/**
 * Get a file for download with signed URL
 */
export async function getFileForAccess(fileId: string, requesterId: string | undefined): Promise<FileRecord & { signedUrl: string }> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");

  if (file.is_public) {
    const signedUrl = await generateSignedUrl(file.storage_path);
    return { ...file, signedUrl };
  }

  if (!requesterId || requesterId !== file.owner_id) {
    throw ApiError.forbidden("This file is private");
  }

  const signedUrl = await generateSignedUrl(file.storage_path);
  return { ...file, signedUrl };
}

/**
 * Get a file by share token (public)
 */
export async function getFileByShareToken(shareToken: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE share_token = $1 AND is_public = true`,
    [shareToken]
  );
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("Shared file not found or is no longer public");
  return file;
}

/**
 * Set visibility of a file
 */
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

/**
 * Delete a file from database and S3
 */
export async function deleteFile(fileId: string, ownerId: string): Promise<void> {
  const file = await getFileForOwner(fileId, ownerId);

  await pool.query(`DELETE FROM files WHERE id = $1`, [fileId]);

  // Delete from S3
  try {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: file.storage_path,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error(`Failed to delete file from S3: ${file.storage_path}`, error);
  }
}
