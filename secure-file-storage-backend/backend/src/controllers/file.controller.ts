import fs from "fs";
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

function serializeFile(file: FileRecord, req: Request) {
  const base = `${req.protocol}://${req.get("host")}`;
  const isPublic = file.is_public && !!file.share_token;
  return {
    id: file.id,
    originalName: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes),
    checksumSha256: file.checksum_sha256,
    isPublic: file.is_public,
    // shareUrl points at the frontend's public share page (works for anyone, no auth).
    shareUrl: isPublic ? `${env.CLIENT_ORIGIN}/share/${file.share_token}` : null,
    // publicDownloadUrl requires no auth and only works while the file is public.
    publicDownloadUrl: isPublic ? `${base}/api/files/public/${file.share_token}/download` : null,
    // downloadUrl requires the owner's JWT and works regardless of visibility.
    downloadUrl: `${base}/api/files/${file.id}/download`,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("No file was provided. Attach a file under the \"file\" field.");
  }

  const isPublic = req.body.isPublic === "true" || req.body.isPublic === true;

  const file = await fileService.createFileRecord({
    ownerId: req.user!.sub,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    storagePath: req.file.path,
    isPublic,
  });

  res.status(201).json({ file: serializeFile(file, req) });
});

export const listFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = await fileService.listUserFiles(req.user!.sub);
  res.status(200).json({ files: files.map((f) => serializeFile(f, req)) });
});

export const getFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileForOwner(req.params.id, req.user!.sub);
  res.status(200).json({ file: serializeFile(file, req) });
});

export const updateVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { isPublic } = req.body as { isPublic: boolean };
  const file = await fileService.setVisibility(req.params.id, req.user!.sub, isPublic);
  res.status(200).json({ file: serializeFile(file, req) });
});

export const removeFile = asyncHandler(async (req: Request, res: Response) => {
  await fileService.deleteFile(req.params.id, req.user!.sub);
  res.status(204).send();
});

/** Streams a file to the client, supporting HTTP Range requests for large files. */
function streamFileToResponse(req: Request, res: Response, file: FileRecord) {
  const stat = fs.statSync(file.storage_path);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Content-Type", file.mime_type);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(file.original_name)}"`
  );
  res.setHeader("Accept-Ranges", "bytes");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": chunkSize,
    });
    fs.createReadStream(file.storage_path, { start, end }).pipe(res);
  } else {
    res.setHeader("Content-Length", fileSize);
    fs.createReadStream(file.storage_path).pipe(res);
  }
}

/** Owner-authenticated or public download, based on JWT presence in Authorization header. */
export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileForAccess(req.params.id, req.user?.sub);
  streamFileToResponse(req, res, file);
});

export const getPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  res.status(200).json({ file: serializeFile(file, req) });
});

export const downloadPublicFile = asyncHandler(async (req: Request, res: Response) => {
  const file = await fileService.getFileByShareToken(req.params.token);
  streamFileToResponse(req, res, file);
});
