// services/storage/s3.service.ts
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { IStorageService } from "./storage.interface";
import { FileMetadata } from "../../types";
import { env } from "../../config/env";
import { v4 as uuidv4 } from "uuid";

export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    console.log('[S3Storage] Initializing S3 storage...');
    
    this.s3Client = new S3Client({
      region: env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = env.AWS_S3_BUCKET_NAME!;
    console.log(`[S3Storage] Using bucket: ${this.bucketName}, region: ${env.AWS_REGION}`);
  }

  async uploadFile(
    file: Express.Multer.File | Buffer,
    originalName: string,
    mimeType: string
  ): Promise<FileMetadata> {
    const fileBuffer = file instanceof Buffer ? file : file.buffer;
    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const storedName = `${uuidv4()}${ext}`;
    const key = `uploads/${storedName}`;

    console.log(`[S3Storage] Uploading file: ${originalName} (${fileBuffer.length} bytes) to ${key}`);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        'original-name': encodeURIComponent(originalName),
        'uploaded-at': new Date().toISOString(),
        'size': String(fileBuffer.length),
      },
    });

    await this.s3Client.send(command);
    console.log(`[S3Storage] Upload complete: ${key}`);

    return {
      id: uuidv4(),
      originalName,
      storedName: key,
      mimeType,
      sizeBytes: fileBuffer.length,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath: key,
      storageType: "s3",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
    console.log(`[S3Storage] Getting file stream: ${fileId}`);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  async getFileUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    console.log(`[S3Storage] Generating signed URL for: ${fileId} (expires in ${expiresIn}s)`);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(fileId: string): Promise<void> {
    console.log(`[S3Storage] Deleting file: ${fileId}`);
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    await this.s3Client.send(command);
  }

  async fileExists(fileId: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileId,
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

  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  async getPresignedUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: 'application/octet-stream',
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}