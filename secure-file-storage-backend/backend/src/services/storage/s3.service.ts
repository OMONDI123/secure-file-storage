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
    this.s3Client = new S3Client({
      region: env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = env.AWS_S3_BUCKET_NAME!;
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
      throw new Error('Invalid file upload: No buffer available');
    }

    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const storedName = `${uuidv4()}${ext}`;
    const key = `uploads/${storedName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        'original-name': encodeURIComponent(originalName),
        'uploaded-by': userId || 'unknown',
        'uploaded-at': new Date().toISOString(),
        'size': String(fileSize),
      },
    });

    await this.s3Client.send(command);

    return {
      id: uuidv4(),
      originalName,
      storedName: key,
      mimeType,
      sizeBytes: fileSize,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath: key,
      storageType: "s3",
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  async getFileUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPublicUrl(fileId: string): Promise<string> {
    return `https://${this.bucketName}.s3.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileId}`;
  }

  async deleteFile(fileId: string): Promise<void> {
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

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: fileId,
    });
    const response = await this.s3Client.send(command);
    
    return {
      id: fileId,
      originalName: response.Metadata?.['original-name'] 
        ? decodeURIComponent(response.Metadata['original-name']) 
        : fileId.split('/').pop() || fileId,
      storedName: fileId,
      mimeType: response.ContentType || 'application/octet-stream',
      sizeBytes: response.ContentLength || 0,
      checksumSha256: null,
      isPublic: false,
      shareToken: null,
      storagePath: fileId,
      storageType: "s3",
      userId: response.Metadata?.['uploaded-by'] || undefined,
      createdAt: response.LastModified || new Date(),
      updatedAt: response.LastModified || new Date(),
    };
  }
}