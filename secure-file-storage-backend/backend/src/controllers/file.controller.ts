import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import * as fileService from "../services/file.service";
import { FileRecord } from "../types";
import { env } from "../config/env";

export const visibilitySchema = z.object({
  isPublic: z.boolean(),
});

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

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("No file was provided. Attach a file under the \"file\" field.");
  }

  const isPublic = req.body.isPublic === "true" || req.body.isPublic === true;
  const file = req.file as any; // multer-s3 adds extra fields

  const fileRecord = await fileService.createFileRecord({
    ownerId: req.user!.sub,
    originalName: file.originalname,
    storedName: file.key, // S3 key
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: file.key, // S3 key
    isPublic,
  });

  const signedUrl = await fileService.generateSignedUrl(file.key);
  res.status(201).json({ file: serializeFile(fileRecord, req, signedUrl) });
});

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

export const getFile = asyncHandler(async (req: Request, res: Response) => {
  const { file, signedUrl } = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  res.status(200).json({ file: serializeFile(file, req, signedUrl) });
});

export const updateVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { isPublic } = req.body as { isPublic: boolean };
  const file = await fileService.setVisibility(req.params.id, req.user!.sub, isPublic);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.status(200).json({ file: serializeFile(file, req, signedUrl) });
});

export const removeFile = asyncHandler(async (req: Request, res: Response) => {
  await fileService.deleteFile(req.params.id, req.user!.sub);
  res.status(204).send();
});

export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const { file, signedUrl } = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  res.redirect(signedUrl);
});

export const getPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.status(200).json({ file: serializeFile(file, req, signedUrl) });
});

export const downloadPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  const signedUrl = await fileService.generateSignedUrl(file.storage_path);
  res.redirect(signedUrl);
});
