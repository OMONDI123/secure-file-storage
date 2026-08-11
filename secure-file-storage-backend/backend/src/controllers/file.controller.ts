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
 * Serializes a FileRecord into a response object.
 *
 * downloadUrl / publicDownloadUrl point at OUR OWN API (which streams the
 * file straight from S3), not at a raw presigned S3 URL. Handing browsers a
 * presigned URL to redirect/navigate to is fragile: any RFC-3986-compliant
 * client normalizes dot-segments out of a URL path before requesting it,
 * which can silently invalidate a SigV4 signature. Proxying through our API
 * avoids that entirely and also means we never need to expose the bucket
 * name/host to clients.
 */
function serializeFile(file: FileRecord, req: Request) {
  const base = `${req.protocol}://${req.get("host")}`;
  const isPublic = file.is_public && !!file.share_token;
  const ownedDownloadUrl = `${base}/api/files/${file.id}/download`;
  const publicDownloadUrl = isPublic ? `${base}/api/files/public/${file.share_token}/download` : null;
  return {
    id: file.id,
    originalName: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes),
    checksumSha256: file.checksum_sha256,
    isPublic: file.is_public,
    shareUrl: isPublic ? `${env.CLIENT_ORIGIN}/share/${file.share_token}` : null,
    publicDownloadUrl,
    downloadUrl: ownedDownloadUrl,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

/**
 * Builds a safe Content-Disposition header value for a given filename,
 * covering both plain ASCII clients and full UTF-8 filenames.
 */
function contentDispositionFor(originalName: string): string {
  const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
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

  res.status(201).json({ file: serializeFile(fileRecord, req) });
});

/**
 * List all files owned by the authenticated user.
 */
export const listFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = await fileService.listUserFiles(req.user!.sub);
  res.status(200).json({ files: files.map((file) => serializeFile(file, req)) });
});

/**
 * Get a specific file by ID.
 * Validates ownership before returning metadata.
 */
export const getFile = asyncHandler(async (req: Request, res: Response) => {
  const { signedUrl, ...file } = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  res.status(200).json({ file: serializeFile(file as FileRecord, req) });
});

/**
 * Update a file's visibility (public/private).
 * Generates or removes a share token based on the new visibility.
 */
export const updateVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { isPublic } = req.body as { isPublic: boolean };
  const file = await fileService.setVisibility(req.params.id, req.user!.sub, isPublic);
  res.status(200).json({ file: serializeFile(file, req) });
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
 * Validates access rights, then streams the file's bytes from S3 straight
 * through this response (rather than redirecting the browser to a presigned
 * S3 URL — see the note on serializeFile for why).
 */
export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  const { stream, contentType, contentLength } = await fileService.getFileStream(file.storage_path);

  res.setHeader("Content-Type", contentType || file.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDispositionFor(file.original_name));
  if (contentLength !== undefined) {
    res.setHeader("Content-Length", String(contentLength));
  }

  stream.on("error", (err) => {
    console.error(`Error streaming file ${file.id}:`, err);
    if (!res.headersSent) {
      res.status(502).json({ error: { message: "Failed to stream file from storage" } });
    } else {
      res.destroy(err);
    }
  });

  stream.pipe(res);
});

/**
 * Get a public file by share token.
 * Returns file metadata only — no signed URL is generated here anymore.
 */
export const getPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  res.status(200).json({ file: serializeFile(file, req) });
});

/**
 * Download a public file by share token.
 * Streams the file's bytes from S3 straight through this response.
 */
export const downloadPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  const { stream, contentType, contentLength } = await fileService.getFileStream(file.storage_path);

  res.setHeader("Content-Type", contentType || file.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDispositionFor(file.original_name));
  if (contentLength !== undefined) {
    res.setHeader("Content-Length", String(contentLength));
  }

  stream.on("error", (err) => {
    console.error(`Error streaming public file ${file.id}:`, err);
    if (!res.headersSent) {
      res.status(502).json({ error: { message: "Failed to stream file from storage" } });
    } else {
      res.destroy(err);
    }
  });

  stream.pipe(res);
});