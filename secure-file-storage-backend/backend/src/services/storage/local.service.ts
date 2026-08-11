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

  async upload(file: Buffer, metadata: FileMetadata): Promise<string> {
    const { key } = metadata;
    
    // Create subdirectories if needed
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, file);
    
    return key;
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getFilePath(key);
    if (!await this.exists(key)) {
      throw new Error(`File not found: ${key}`);
    }
    return createReadStream(filePath);
  }

  async getDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    // For local storage, return the API endpoint URL
    return `/api/files/download/${key}`;
  }

  getPublicUrl(key: string): string {
    // For local storage, public files are served through API
    const publicBaseUrl = process.env.PUBLIC_URL || 'http://localhost:4000';
    return `${publicBaseUrl}/api/files/public/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    const dirPath = prefix ? this.getFilePath(prefix) : this.storagePath;
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      const result: string[] = [];
      
      for (const file of files) {
        if (file.isDirectory()) {
          // Recursively get files from subdirectories
          const subPrefix = prefix ? path.join(prefix, file.name) : file.name;
          const subFiles = await this.listFiles(subPrefix);
          result.push(...subFiles);
        } else {
          const filePath = prefix ? path.join(prefix, file.name) : file.name;
          result.push(filePath);
        }
      }
      
      return result;
    } catch {
      return [];
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const sourcePath = this.getFilePath(sourceKey);
    const destPath = this.getFilePath(destinationKey);
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    
    await fs.copyFile(sourcePath, destPath);
  }

  async getFileMetadata(key: string): Promise<FileMetadata> {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    
    // Extract original name from key (last part after the last slash)
    const originalName = path.basename(key);
    // Try to determine mime type from extension
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = this.getMimeTypeFromExtension(ext);
    
    return {
      key,
      originalName,
      mimeType,
      size: stats.size,
      userId: 'unknown',
      visibility: 'private',
      uploadedAt: stats.birthtime || stats.ctime || new Date(),
    };
  }

  // Helper to get mime type from extension
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.md': 'text/markdown',
      '.rtf': 'application/rtf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.7z': 'application/x-7z-compressed',
      '.rar': 'application/x-rar-compressed',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Local-specific helper methods
  async getFileSize(key: string): Promise<number> {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  async getFileStats(key: string): Promise<any> {
    const filePath = this.getFilePath(key);
    return await fs.stat(filePath);
  }

  // Get full file path (useful for debugging)
  getFullPath(key: string): string {
    return this.getFilePath(key);
  }
}