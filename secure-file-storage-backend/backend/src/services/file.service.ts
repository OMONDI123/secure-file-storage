import crypto from "crypto";
import { Readable } from "stream";
import { s3Client } from "../config/s3";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { FileRecord } from "../types";

/**
 * Generates a secure random token for public file sharing.
 * Uses base64url encoding for URL-safe characters.
 */
function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Sanitizes a storage path before it is written to the database for a NEW
 * upload. This does NOT touch existing rows.
 *
 * Historically this function added a "./" prefix "to match S3". That was the
 * root cause of downloads failing in every browser (see the comment in
 * middleware/upload.ts for the full explanation): a leading "./" is a
 * dot-segment that RFC-3986/WHATWG-URL-compliant clients strip out of a URL
 * path during navigation, which silently changes the request path sent to
 * S3 out from under a SigV4-signed URL. We now do the opposite: strip any
 * leading "./" so newly written rows are always clean.
 */
function normalizeStoragePath(storagePath: string): string {
  const withoutDotPrefix = storagePath.replace(/^(\.\/)+/, "");
  if (withoutDotPrefix.startsWith("storage/")) {
    return withoutDotPrefix;
  }
  return `storage/${withoutDotPrefix}`;
}

/**
 * Generates a pre-signed URL for S3 file access.
 * Default expiration is 1 hour (3600 seconds).
 *
 * NOTE: presigned URLs are inherently fragile for redirect-based downloads
 * (see explanation above) whenever a key contains characters a URL parser
 * would normalize. Prefer `getFileStream` + streaming the response through
 * our own API for anything the browser will navigate/redirect to. This is
 * kept around for cases where handing out a direct, time-limited S3 URL is
 * genuinely useful (e.g. server-to-server, admin tooling).
 */
export async function generateSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
  try {
    console.log(`[S3] Generating signed URL for key: "${storagePath}"`);
    console.log(`[S3] Bucket: ${env.AWS_S3_BUCKET_NAME}`);

    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: storagePath,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    console.log(`[S3] Signed URL generated successfully`);
    return url;
  } catch (error) {
    console.error(`Failed to generate signed URL for ${storagePath}:`, error);
    throw new ApiError(500, "Failed to generate file access URL");
  }
}

/**
 * Fetches a file's bytes directly from S3 and returns a readable stream
 * plus its metadata, so the caller can pipe it straight through our own
 * API response. This is the download path actually used by the app.
 *
 * Streaming through our own server (instead of redirecting the browser to
 * a presigned S3 URL) sidesteps the URL-normalization problem entirely:
 * the SigV4 signature is computed and the request is sent in the very
 * same call, with no intermediate Location-header round trip through the
 * browser's URL parser. It also means legacy rows whose storage_path still
 * contains a literal "./" (from before this fix) keep working with zero
 * migration, since we always use the exact key stored in the database.
 */
export async function getFileStream(
  storagePath: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  try {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: storagePath,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new ApiError(404, "File content could not be found in storage");
    }
    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`Failed to fetch file stream for key "${storagePath}":`, error);
    throw new ApiError(404, "File could not be retrieved from storage");
  }
}

/**
 * Creates a new file record in the database.
 * Generates a share token if the file is marked as public.
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
  // Ensure the storage path has the correct prefix
  const normalizedPath = normalizeStoragePath(params.storagePath);
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
      normalizedPath,
      params.isPublic,
      shareToken,
    ]
  );
  return result.rows[0];
}

/**
 * Lists all files owned by a user, ordered by creation date (newest first).
 */
export async function listUserFiles(ownerId: string): Promise<FileRecord[]> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return result.rows;
}

/**
 * Retrieves a file record for the file owner.
 * Throws appropriate errors if the file doesn't exist or the user lacks access.
 */
export async function getFileForOwner(fileId: string, ownerId: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) {
    throw ApiError.notFound("File not found");
  }
  if (file.owner_id !== ownerId) {
    throw ApiError.forbidden("You do not have access to this file");
  }
  return file;
}

/**
 * Retrieves a file for access (download/preview).
 * Public files are accessible via share token; private files require ownership.
 * Returns the file record with a signed URL for immediate download.
 */
export async function getFileForAccess(fileId: string, requesterId: string | undefined): Promise<FileRecord & { signedUrl: string }> {
  const result = await pool.query<FileRecord>(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) {
    throw ApiError.notFound("File not found");
  }

  // Public files are accessible to anyone with the file ID
  if (file.is_public) {
    const signedUrl = await generateSignedUrl(file.storage_path);
    return { ...file, signedUrl };
  }

  // Private files require authentication and ownership
  if (!requesterId) {
    throw ApiError.unauthorized("Authentication required to access this file");
  }
  if (requesterId !== file.owner_id) {
    throw ApiError.forbidden("You do not have permission to access this file");
  }

  const signedUrl = await generateSignedUrl(file.storage_path);
  return { ...file, signedUrl };
}

/**
 * Retrieves a public file by its share token.
 * Only returns files that are explicitly marked as public.
 */
export async function getFileByShareToken(shareToken: string): Promise<FileRecord> {
  const result = await pool.query<FileRecord>(
    `SELECT * FROM files WHERE share_token = $1 AND is_public = true`,
    [shareToken]
  );
  const file = result.rows[0];
  if (!file) {
    throw ApiError.notFound("Shared file not found or is no longer public");
  }
  return file;
}

/**
 * Updates the visibility (public/private) of a file.
 * Generates or removes the share token as needed.
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
    `UPDATE files 
     SET is_public = $1, share_token = $2, updated_at = now() 
     WHERE id = $3 
     RETURNING *`,
    [isPublic, shareToken, fileId]
  );
  return result.rows[0];
}

/**
 * Deletes a file from both the database and S3 storage.
 * Handles S3 deletion errors gracefully (logs but doesn't fail the operation).
 */
export async function deleteFile(fileId: string, ownerId: string): Promise<void> {
  const file = await getFileForOwner(fileId, ownerId);

  // Delete from database first (prevents orphaned records)
  await pool.query(`DELETE FROM files WHERE id = $1`, [fileId]);

  // Attempt to delete from S3, log errors but don't fail.
  // Use the exact key as stored in the DB (do NOT "normalize" it) — that's
  // the literal key the object actually lives under, whether it's a clean
  // new-style key or a legacy one with a leading "./".
  try {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: file.storage_path,
    });
    await s3Client.send(command);
    console.log(`[S3] File deleted: ${file.storage_path}`);
  } catch (error) {
    console.error(`Failed to delete file from S3: ${file.storage_path}`, error);
  }
}

/**
 * Increments the download count for a file.
 * Used for tracking file popularity and analytics.
 */
export async function incrementDownloadCount(fileId: string): Promise<void> {
  await pool.query(
    `UPDATE files 
     SET download_count = download_count + 1, last_downloaded_at = now() 
     WHERE id = $1`,
    [fileId]
  );
}

/**
 * Gets the total storage usage for a user in bytes.
 */
export async function getUserStorageUsage(ownerId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(size_bytes), 0) as total FROM files WHERE owner_id = $1`,
    [ownerId]
  );
  return Number(result.rows[0]?.total || 0);
}