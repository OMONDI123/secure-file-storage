import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import * as fileService from "../services/file.service";
import { FileRecord } from "../types";
import { env } from "../config/env";

/**
 * Validation schema for visibility updates.
 */
export const visibilitySchema = z.object({
  isPublic: z.boolean(),
});

/**
 * Serializes a FileRecord into a response object with signed URLs for download.
 */
function serializeFile(file: FileRecord, req: Request, signedUrl?: string) {
  const base = `${req.protocol}://${req.get("host")}`;
  const isPublic = file.is_public && !!file.share_token;
  return {
    id: file.id,
    originalName: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes),
    checksumSha256: file.checksum_sha256,
    isPublic: file.is_public,
    shareUrl: isPublic ? `${env.CLIENT_ORIGIN}/share/${file.share_token}` : null,
    publicDownloadUrl: signedUrl || null,
    downloadUrl: signedUrl || null,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

/**
 * Upload a new file.
 * Handles S3 upload and creates a database record.
 * Supports setting initial visibility (public/private).
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("No file was provided. Attach a file under the \"file\" field.");
  }

  const isPublic = req.body.isPublic === "true" || req.body.isPublic === true;
  const uploadedFile = req.file as any;

  // Use the S3 key directly for storage path
  const s3Key = uploadedFile.key;

  const fileRecord = await fileService.createFileRecord({
    ownerId: req.user!.sub,
    originalName: uploadedFile.originalname,
    storedName: s3Key,
    mimeType: uploadedFile.mimetype,
    sizeBytes: uploadedFile.size,
    storagePath: s3Key,
    isPublic,
  });

  const signedUrl = await fileService.generateSignedUrl(s3Key);
  res.status(201).json({ file: serializeFile(fileRecord, req, signedUrl) });
});

/**
 * List all files owned by the authenticated user.
 * Generates signed URLs for immediate download access.
 */
export const listFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = await fileService.listUserFiles(req.user!.sub);
  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const signedUrl = await fileService.generateSignedUrl(file.storage_path);
      return serializeFile(file, req, signedUrl);
    })
  );
  res.status(200).json({ files: filesWithUrls });
});

/**
 * Get a specific file by ID.
 * Validates ownership and generates a signed URL for download.
 */
export const getFile = asyncHandler(async (req: Request, res: Response) => {
  const fileWithSignedUrl = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  const { signedUrl, ...file } = fileWithSignedUrl;
  res.status(200).json({ file: serializeFile(file as FileRecord, req, signedUrl) });
});

/**
 * Update a file's visibility (public/private).
 * Generates or removes a share token based on the new visibility.
 */
export const updateVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { isPublic } = req.body as { isPublic: boolean };
  const file = await fileService.setVisibility(req.params.id, req.user!.sub, isPublic);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.status(200).json({ file: serializeFile(file, req, signedUrl) });
});

/**
 * Delete a file.
 * Removes the file from both the database and S3 storage.
 */
export const removeFile = asyncHandler(async (req: Request, res: Response) => {
  await fileService.deleteFile(req.params.id, req.user!.sub);
  res.status(204).send();
});

/**
 * Download a file by ID.
 * Validates access rights and redirects to a signed S3 URL.
 */
export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const fileWithSignedUrl = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  const { signedUrl } = fileWithSignedUrl;
  res.redirect(signedUrl);
});

/**
 * Get a public file by share token.
 * Returns file metadata with a signed download URL.
 */
export const getPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.status(200).json({ file: serializeFile(file, req, signedUrl) });
});

/**
 * Download a public file by share token.
 * Redirects to a signed S3 URL for the file.
 */
export const downloadPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.redirect(signedUrl);
});