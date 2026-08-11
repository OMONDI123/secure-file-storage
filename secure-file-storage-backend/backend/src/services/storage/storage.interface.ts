// services/storage/storage.interface.ts
import { FileMetadata } from "../../types";

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param file - File buffer or Multer file object
   * @param originalName - Original filename
   * @param mimeType - MIME type of the file
   * @returns FileMetadata of the uploaded file
   */
  uploadFile(
    file: Express.Multer.File | Buffer,
    originalName: string,
    mimeType: string
  ): Promise<FileMetadata>;
  
  /**
   * Get a readable stream of a file
   * @param fileId - Storage key/path of the file
   * @returns Readable stream of the file
   */
  getFileStream(fileId: string): Promise<NodeJS.ReadableStream>;
  
  /**
   * Generate a download URL for a file (presigned URL for S3, direct path for local)
   * @param fileId - Storage key/path of the file
   * @param expiresIn - Expiration time in seconds (optional)
   * @returns Download URL
   */
  getFileUrl(fileId: string, expiresIn?: number): Promise<string>;
  
  /**
   * Delete a file from storage
   * @param fileId - Storage key/path of the file
   */
  deleteFile(fileId: string): Promise<void>;
  
  /**
   * Check if a file exists in storage
   * @param fileId - Storage key/path of the file
   * @returns True if file exists
   */
  fileExists(fileId: string): Promise<boolean>;
}