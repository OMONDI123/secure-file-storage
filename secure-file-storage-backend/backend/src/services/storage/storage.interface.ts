// services/storage/storage.interface.ts
import { FileMetadata } from "../../types";

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param file - File buffer or Multer file object
   * @param originalName - Original filename
   * @param mimeType - MIME type of the file
   * @param userId - Optional user ID for ownership tracking
   * @returns FileMetadata of the uploaded file
   */
  uploadFile(
    file: Express.Multer.File | Buffer,
    originalName: string,
    mimeType: string,
    userId?: string
  ): Promise<FileMetadata>;
  
  /**
   * Get a readable stream of a file
   * @param fileId - Storage key/path of the file
   * @returns Readable stream of the file
   */
  getFileStream(fileId: string): Promise<NodeJS.ReadableStream>;
  
  /**
   * Generate a download URL for a file
   * @param fileId - Storage key/path of the file
   * @param expiresIn - Expiration time in seconds
   * @returns Download URL
   */
  getFileUrl(fileId: string, expiresIn?: number): Promise<string>;
  
  /**
   * Get a public URL for a file
   * @param fileId - Storage key/path of the file
   * @returns Public URL
   */
  getPublicUrl(fileId: string): Promise<string>;
  
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
  
  /**
   * Get file metadata
   * @param fileId - Storage key/path of the file
   * @returns File metadata
   */
  getFileMetadata(fileId: string): Promise<FileMetadata>;
}