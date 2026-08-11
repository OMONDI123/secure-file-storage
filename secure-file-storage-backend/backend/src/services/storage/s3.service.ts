// services/storage/s3.service.ts
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { IStorageService } from "./storage.interface";
import { FileMetadata } from "../../types";
import { env } from "../../config/env";

export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
      ...(env.AWS_S3_ENDPOINT && { endpoint: env.AWS_S3_ENDPOINT }),
    });
    this.bucketName = env.S3_BUCKET_NAME!;
  }

  async upload(file: Buffer, metadata: FileMetadata): Promise<string> {
    const { key, originalName, mimeType, userId, visibility } = metadata;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: mimeType,
      Metadata: {
        'original-name': encodeURIComponent(originalName),
        'uploaded-by': userId,
        'visibility': visibility,
        'uploaded-at': new Date().toISOString(),
        'size': String(file.length),
      },
    });

    await this.s3Client.send(command);
    return key;
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  getPublicUrl(key: string): string {
    // If using a custom endpoint (like DigitalOcean Spaces)
    if (env.AWS_S3_ENDPOINT) {
      return `${env.AWS_S3_ENDPOINT}/${this.bucketName}/${key}`;
    }
    // Standard AWS S3 URL
    return `https://${this.bucketName}.s3.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });

    const response = await this.s3Client.send(command);
    return (response.Contents || []).map(obj => obj.Key || '');
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.s3Client.send(command);
  }

  async getFileMetadata(key: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    return {
      key,
      originalName: response.Metadata?.['original-name'] 
        ? decodeURIComponent(response.Metadata['original-name']) 
        : key.split('/').pop() || key,
      mimeType: response.ContentType || 'application/octet-stream',
      size: response.ContentLength || 0,
      userId: response.Metadata?.['uploaded-by'] || 'unknown',
      visibility: (response.Metadata?.['visibility'] as 'public' | 'private') || 'private',
      uploadedAt: response.LastModified || new Date(),
    };
  }

  // S3-specific helper methods
  async getPresignedUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getFileUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.getDownloadUrl(key, expiresIn);
  }
}