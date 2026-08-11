// services/storage/storage.factory.ts
import { env } from "../../config/env";
import { IStorageService } from "./storage.interface";
import { LocalStorageService } from "./local.service";
import { S3StorageService } from "./s3.service";

export class StorageFactory {
  private static instance: IStorageService | null = null;

  /**
   * Get the storage service instance based on available credentials
   * @returns IStorageService instance
   */
  static getStorageService(): IStorageService {
    if (!StorageFactory.instance) {
      // Check if we have S3 credentials
      const useS3 = env.AWS_ACCESS_KEY_ID && 
                    env.AWS_SECRET_ACCESS_KEY && 
                    env.AWS_S3_BUCKET_NAME;

      if (useS3) {
        console.log('[Storage] Initializing S3 storage service');
        StorageFactory.instance = new S3StorageService();
      } else {
        console.log('[Storage] Initializing Local storage service');
        StorageFactory.instance = new LocalStorageService();
      }
    }
    return StorageFactory.instance;
  }

  /**
   * Reset the storage service instance (useful for testing)
   */
  static reset(): void {
    StorageFactory.instance = null;
  }

  /**
   * Check if S3 storage is configured
   */
  static isS3Configured(): boolean {
    return !!(env.AWS_ACCESS_KEY_ID && 
              env.AWS_SECRET_ACCESS_KEY && 
              env.AWS_S3_BUCKET_NAME);
  }

  /**
   * Get the current storage type
   */
  static getStorageType(): string {
    return this.isS3Configured() ? 's3' : 'local';
  }
}

// Export a singleton instance for easy use
export const storageService = StorageFactory.getStorageService();