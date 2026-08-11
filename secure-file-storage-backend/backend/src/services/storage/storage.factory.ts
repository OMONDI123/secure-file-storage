// services/storage/storage.factory.ts
import { env } from "../../config/env";
import { IStorageService } from "./storage.interface";
import { LocalStorageService } from "./local.service";
import { S3StorageService } from "./s3.service";

export class StorageFactory {
  private static instance: IStorageService | null = null;

  static getStorageService(): IStorageService {
    if (!StorageFactory.instance) {
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

  static reset(): void {
    StorageFactory.instance = null;
  }

  static isS3Configured(): boolean {
    return !!(env.AWS_ACCESS_KEY_ID && 
              env.AWS_SECRET_ACCESS_KEY && 
              env.AWS_S3_BUCKET_NAME);
  }

  static getStorageType(): string {
    return this.isS3Configured() ? 's3' : 'local';
  }
}

export const storageService = StorageFactory.getStorageService();