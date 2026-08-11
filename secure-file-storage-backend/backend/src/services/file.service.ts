// services/file.service.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { FileRecord } from "../types";
import { storageService } from "./storage/storage.factory";

function computeChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function generateStoredName(originalName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const extension = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, extension);
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
  return `${timestamp}_${random}_${sanitizedName}${extension}`;
}

/**
 * Upload a file with support for both local and S3 storage
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  ownerId: string,
  isPublic: boolean = false
): Promise<FileRecord> {
  try {
    // Generate unique storage key
    const storedName = generateStoredName(originalName);
    const storageKey = `${ownerId}/${storedName}`;

    // Compute checksum before upload
    const checksum = computeChecksum(fileBuffer);

    // Upload to storage (local or S3)
    await storageService.upload(fileBuffer, {
      key: storageKey,
      originalName,
      mimeType,
      size: fileBuffer.length,
      userId: ownerId,
      visibility: isPublic ? 'public' : 'private',
    });

    // Create database record
    const result = await pool.query(
      `INSERT INTO files
        (owner_id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, is_public, share_token, storage_key, storage_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        ownerId,
        originalName,
        storedName,
        mimeType,
        fileBuffer.length,
        checksum,
        isPublic,
        isPublic ? generateShareToken() : null,
        storageKey,
        env.STORAGE_TYPE || 'local',
      ]
    );

    const file = result.rows[0];

    // Generate download URL based on visibility
    const downloadUrl = isPublic 
      ? storageService.getPublicUrl(storageKey)
      : await storageService.getDownloadUrl(storageKey, env.PRIVATE_FILE_EXPIRY || 300);

    return {
      ...file,
      download_url: downloadUrl,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw ApiError.internal('Failed to upload file');
  }
}

export async function listUserFiles(ownerId: string): Promise<FileRecord[]> {
  const result = await pool.query(
    `SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  
  // Enrich files with download URLs
  const files = result.rows;
  for (const file of files) {
    try {
      if (file.is_public) {
        file.download_url = storageService.getPublicUrl(file.storage_key);
      } else {
        file.download_url = await storageService.getDownloadUrl(file.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
      }
    } catch (error) {
      console.error(`Failed to generate URL for file ${file.id}:`, error);
    }
  }
  
  return files;
}

export async function getFileForOwner(fileId: string, ownerId: string): Promise<FileRecord> {
  const result = await pool.query(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");
  if (file.owner_id !== ownerId) throw ApiError.forbidden("You do not have access to this file");
  
  // Generate download URL
  try {
    file.download_url = file.is_public
      ? storageService.getPublicUrl(file.storage_key)
      : await storageService.getDownloadUrl(file.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
  } catch (error) {
    console.error(`Failed to generate URL for file ${file.id}:`, error);
  }
  
  return file;
}

/**
 * Resolves a file for download/preview, enforcing authorization:
 * - Public files are accessible to anyone with the share token.
 * - Private files are only accessible to their authenticated owner.
 */
export async function getFileForAccess(
  fileId: string, 
  requesterId: string | undefined
): Promise<FileRecord> {
  const result = await pool.query(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("File not found");

  if (file.is_public) {
    // Generate public URL
    file.download_url = storageService.getPublicUrl(file.storage_key);
    return file;
  }

  if (!requesterId || requesterId !== file.owner_id) {
    throw ApiError.forbidden("This file is private");
  }

  // Generate private download URL
  try {
    file.download_url = await storageService.getDownloadUrl(file.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
  } catch (error) {
    console.error(`Failed to generate URL for file ${file.id}:`, error);
    throw ApiError.internal('Failed to generate download URL');
  }

  return file;
}

export async function getFileByShareToken(shareToken: string): Promise<FileRecord> {
  const result = await pool.query(
    `SELECT * FROM files WHERE share_token = $1 AND is_public = true`,
    [shareToken]
  );
  const file = result.rows[0];
  if (!file) throw ApiError.notFound("Shared file not found or is no longer public");
  
  // Generate public URL
  file.download_url = storageService.getPublicUrl(file.storage_key);
  return file;
}

export async function setVisibility(
  fileId: string, 
  ownerId: string, 
  isPublic: boolean
): Promise<FileRecord> {
  const file = await getFileForOwner(fileId, ownerId);

  let shareToken = file.share_token;
  if (isPublic && !shareToken) {
    shareToken = generateShareToken();
  }
  if (!isPublic) {
    shareToken = null;
  }

  const result = await pool.query(
    `UPDATE files 
     SET is_public = $1, share_token = $2, updated_at = now() 
     WHERE id = $3 
     RETURNING *`,
    [isPublic, shareToken, fileId]
  );
  
  const updatedFile = result.rows[0];
  
  // Generate download URL for response
  try {
    updatedFile.download_url = isPublic
      ? storageService.getPublicUrl(updatedFile.storage_key)
      : await storageService.getDownloadUrl(updatedFile.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
  } catch (error) {
    console.error(`Failed to generate URL for file ${updatedFile.id}:`, error);
  }
  
  return updatedFile;
}

export async function deleteFile(fileId: string, ownerId: string): Promise<void> {
  const file = await getFileForOwner(fileId, ownerId);

  // Delete from storage (local or S3)
  try {
    await storageService.delete(file.storage_key);
  } catch (error) {
    console.error(`Failed to delete file from storage: ${file.storage_key}`, error);
    // Continue to delete from database even if storage deletion fails
  }

  // Delete from database
  await pool.query(`DELETE FROM files WHERE id = $1`, [fileId]);
}

/**
 * Generate a download URL for a file
 */
export async function generateDownloadUrl(
  fileId: string, 
  requesterId: string | undefined
): Promise<string> {
  const file = await getFileForAccess(fileId, requesterId);
  
  if (file.is_public) {
    return storageService.getPublicUrl(file.storage_key);
  } else {
    return await storageService.getDownloadUrl(file.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
  }
}

/**
 * Check if a file exists in storage
 */
export async function fileExistsInStorage(fileId: string): Promise<boolean> {
  const result = await pool.query(`SELECT * FROM files WHERE id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) return false;
  
  return await storageService.exists(file.storage_key);
}

/**
 * Get file stream (for local storage or S3)
 */
export async function getFileStream(fileId: string, requesterId: string | undefined): Promise<NodeJS.ReadableStream> {
  const file = await getFileForAccess(fileId, requesterId);
  return await storageService.getReadStream(file.storage_key);
}

/**
 * Get file download URL directly from storage
 */
export async function getFileDownloadUrl(fileId: string, requesterId: string | undefined): Promise<string> {
  const file = await getFileForAccess(fileId, requesterId);
  return await storageService.getDownloadUrl(file.storage_key, env.PRIVATE_FILE_EXPIRY || 300);
}

// Legacy support - for backward compatibility with existing code
export async function createFileRecordLegacy(params: {
  ownerId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  isPublic: boolean;
}): Promise<FileRecord> {
  // For backward compatibility, we'll use the storageKey approach
  // but derive it from the storagePath
  const storageKey = params.storagePath.replace(/^\.\/storage\//, '');
  
  const result = await pool.query(
    `INSERT INTO files
      (owner_id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, is_public, share_token, storage_key, storage_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.ownerId,
      params.originalName,
      params.storedName,
      params.mimeType,
      params.sizeBytes,
      null, // checksum will be computed later
      params.isPublic,
      params.isPublic ? generateShareToken() : null,
      storageKey,
      env.STORAGE_TYPE || 'local',
    ]
  );
  return result.rows[0];
}