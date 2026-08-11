// services/storage/local.service.ts
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { IStorageService } from "./storage.interface";
import { FileMetadata } from "../../types";
import { env } from "../../config/env";

export class LocalStorageService implements IStorageService {
  private storagePath: string;

  constructor() {
    this.storagePath = path.resolve(env.STORAGE_DIR || "./storage");
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      console.log(`[LocalStorage] Directory ready: ${this.storagePath}`);
    } catch (error) {
      console.error('Failed to create storage directory:', error);
      throw error;
    }
  }

  private getFilePath(key: string): string {
    // Prevent path traversal
    const safeKey = key.replace(/\.\./g, '').replace(/\\/g, '/');
    return path.join(this.storagePath, safeKey);
  }

  // ✅ Updated to match IStorageService interface
  async uploadFile(
    file: Express.Multer.File | Buffer,
    originalName: string,
    mimeType: string
  ): Promise<FileMetadata> {
    const fileBuffer = file instanceof Buffer ? file : file.buffer;
    const ext = path.extname(originalName);
    const storedName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const storagePath = `uploads/${storedName}`;
    const filePath = this.getFilePath(storagePath);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, fileBuffer);

    return {
      id: `local-${Date.now()}`,
      originalName,
      storedName: storagePath,
      mimeType,
      sizeBytes: fileBuffer.length,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath,
      storageType: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ✅ Updated to match IStorageService interface
  async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getFilePath(fileId);
    if (!await this.fileExists(fileId)) {
      throw new Error(`File not found: ${fileId}`);
    }
    return createReadStream(filePath);
  }

  // ✅ Updated to match IStorageService interface
  async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    // For local storage, return the API endpoint URL
    return `/api/files/${fileId}/download`;
  }

  // ✅ Updated to match IStorageService interface
  async deleteFile(fileId: string): Promise<void> {
    const filePath = this.getFilePath(fileId);
    try {
      await fs.unlink(filePath);
      console.log(`[LocalStorage] Deleted file: ${fileId}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, ignore
    }
  }

  // ✅ Updated to match IStorageService interface
  async fileExists(fileId: string): Promise<boolean> {
    const filePath = this.getFilePath(fileId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ✅ Additional helper methods
  async getFileSize(key: string): Promise<number> {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  async getFileStats(key: string): Promise<any> {
    const filePath = this.getFilePath(key);
    return await fs.stat(filePath);
  }

  getFullPath(key: string): string {
    return this.getFilePath(key);
  }

  // ✅ Method to get public URL
  getPublicUrl(key: string): string {
    const publicBaseUrl = process.env.PUBLIC_URL || 'http://localhost:4000';
    return `${publicBaseUrl}/api/files/public/${key}`;
  }
}