// services/storage/local.service.ts
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { IStorageService } from "./storage.interface";
import { FileMetadata } from "../../types";
import { env } from "../../config/env";
import { v4 as uuidv4 } from "uuid";

export class LocalStorageService implements IStorageService {
  private storagePath: string;

  constructor() {
    this.storagePath = path.resolve(env.STORAGE_DIR || "./storage");
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
      throw error;
    }
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/\.\./g, '').replace(/\\/g, '/');
    return path.join(this.storagePath, safeKey);
  }

  // ✅ Fixed: Get file size correctly from Buffer
  private getFileSize(file: Express.Multer.File | Buffer): number {
    if (Buffer.isBuffer(file)) {
      return file.length;
    }
    if (file.buffer) {
      return file.buffer.length;
    }
    if (file.size) {
      return file.size;
    }
    return 0;
  }

  async uploadFile(
    file: Express.Multer.File | Buffer,
    originalName: string,
    mimeType: string,
    userId?: string
  ): Promise<FileMetadata> {
    // ✅ Get the file buffer correctly
    let fileBuffer: Buffer;
    let fileSize: number;
    
    if (Buffer.isBuffer(file)) {
      fileBuffer = file;
      fileSize = file.length;
    } else if (file.buffer) {
      fileBuffer = file.buffer;
      fileSize = file.buffer.length;
    } else {
      // Fallback - read from disk if it's a file path
      throw new Error('Invalid file upload: No buffer available');
    }

    const ext = path.extname(originalName);
    const storedName = `${uuidv4()}${ext}`;
    const storagePath = `uploads/${storedName}`;
    const filePath = this.getFilePath(storagePath);
    
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, fileBuffer);

    return {
      id: uuidv4(),
      originalName,
      storedName,
      mimeType,
      sizeBytes: fileSize,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath,
      storageType: "local",
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getFilePath(fileId);
    if (!await this.fileExists(fileId)) {
      throw new Error(`File not found: ${fileId}`);
    }
    return createReadStream(filePath);
  }

  async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    return `/api/files/${fileId}/download`;
  }

  async getPublicUrl(fileId: string): Promise<string> {
    const publicBaseUrl = process.env.PUBLIC_URL || 'http://localhost:4000';
    return `${publicBaseUrl}/api/files/public/${fileId}`;
  }

  async deleteFile(fileId: string): Promise<void> {
    const filePath = this.getFilePath(fileId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(fileId: string): Promise<boolean> {
    const filePath = this.getFilePath(fileId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const filePath = this.getFilePath(fileId);
    const stats = await fs.stat(filePath);
    
    return {
      id: fileId,
      originalName: path.basename(fileId),
      storedName: fileId,
      mimeType: 'application/octet-stream',
      sizeBytes: stats.size,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath: fileId,
      storageType: "local",
      createdAt: stats.birthtime || stats.ctime || new Date(),
      updatedAt: stats.mtime || new Date(),
    };
  }
}