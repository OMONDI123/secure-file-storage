// services/storage/storage.interface.ts
import { FileMetadata } from "../../types";

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param file - File buffer to upload
   * @param metadata - File metadata
   * @returns The storage key/path of the uploaded file
   */
  upload(file: Buffer, metadata: FileMetadata): Promise<string>;
  
  /**
   * Get a readable stream of a file
   * @param key - Storage key of the file
   * @returns Readable stream of the file
   */
  getReadStream(key: string): Promise<NodeJS.ReadableStream>;
  
  /**
   * Generate a download URL for a file (presigned URL for S3, direct path for local)
   * @param key - Storage key of the file
   * @param expiresIn - Expiration time in seconds
   * @returns Download URL
   */
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  
  /**
   * Get a public URL for a file (direct S3 URL or API endpoint)
   * @param key - Storage key of the file
   * @returns Public URL
   */
  getPublicUrl(key: string): string;
  
  /**
   * Delete a file from storage
   * @param key - Storage key of the file
   */
  delete(key: string): Promise<void>;
  
  /**
   * Check if a file exists in storage
   * @param key - Storage key of the file
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * List all files in a directory/prefix
   * @param prefix - Optional prefix to filter files
   * @returns Array of file keys
   */
  listFiles(prefix?: string): Promise<string[]>;
  
  /**
   * Copy a file from one key to another
   * @param sourceKey - Source storage key
   * @param destinationKey - Destination storage key
   */
  copyFile(sourceKey: string, destinationKey: string): Promise<void>;
  
  /**
   * Get file metadata
   * @param key - Storage key of the file
   * @returns File metadata
   */
  getFileMetadata(key: string): Promise<FileMetadata>;
}