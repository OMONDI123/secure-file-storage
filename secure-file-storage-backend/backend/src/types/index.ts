// types/index.ts - Complete file with all types

// ============================================
// Core Types
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface FileRecord {
  id: string;
  owner_id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: string; // BIGINT comes back as string from pg
  checksum_sha256: string | null;
  is_public: boolean;
  share_token: string | null;
  // Legacy - kept for backward compatibility
  storage_path?: string; // Made optional as it's being deprecated
  // New fields
  storage_key: string; // S3 key or relative path (NOT NULL)
  storage_type: 'local' | 's3'; // Which storage system was used
  // Computed field (not stored in DB)
  download_url?: string; // Generated on-demand
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ============================================
// File Types
// ============================================

export interface FileUploadRequest {
  file: Express.Multer.File;
  isPublic?: boolean;
}

export interface FileUpdateRequest {
  isPublic?: boolean;
  name?: string;
}

export interface FileShareRequest {
  expiresIn?: number; // In seconds
  password?: string; // Optional password protection
}

export interface FileListQuery {
  page?: number;
  limit?: number;
  search?: string;
  mimeType?: string;
  isPublic?: boolean;
  sortBy?: 'created_at' | 'name' | 'size';
  sortOrder?: 'ASC' | 'DESC';
}

export interface FileUploadResponse {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  downloadUrl: string;
  shareToken?: string;
  shareUrl?: string;
  createdAt: Date;
}

export interface FileListResponse {
  files: FileRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ShareFileResponse {
  shareToken: string;
  shareUrl: string;
  fileId: string;
  expiresAt?: Date;
}

export interface FileDownloadResponse {
  downloadUrl: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface FileFilters {
  search?: string;
  mimeType?: string;
  isPublic?: boolean;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'created_at' | 'size_bytes' | 'original_name';
  sortOrder?: 'ASC' | 'DESC';
}

export interface FileStatistics {
  totalFiles: number;
  totalSize: number; // In bytes
  publicFiles: number;
  privateFiles: number;
  storageType: 'local' | 's3';
  storageUsed: string; // Human readable (e.g., "1.2 GB")
  mostUsedMimeType: string;
}

// ============================================
// Storage Types
// ============================================

export interface FileMetadata {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  visibility: 'public' | 'private';
  uploadedAt?: Date;
  [key: string]: any; // For additional metadata
}

export interface IStorageService {
  upload(file: Buffer, metadata: FileMetadata): Promise<string>;
  getReadStream(key: string): Promise<NodeJS.ReadableStream>;
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  listFiles(prefix?: string): Promise<string[]>;
  copyFile(sourceKey: string, destinationKey: string): Promise<void>;
  getFileMetadata(key: string): Promise<FileMetadata>;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  bucketName?: string;
  storageType: 'local' | 's3';
  region?: string;
}

export interface UploadOptions {
  key?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'public-read' | 'private' | 'authenticated-read';
  cacheControl?: string;
  expires?: Date;
}

export interface StorageConfig {
  type: 'local' | 's3';
  local?: {
    storageDir: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
}

export interface StorageMetadata {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  visibility: 'public' | 'private';
  uploadedAt: Date;
}

// ============================================
// Database Types
// ============================================

export interface DatabaseFileRecord {
  id: string;
  owner_id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: string;
  checksum_sha256: string | null;
  is_public: boolean;
  share_token: string | null;
  storage_key: string;
  storage_type: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================
// JWT Types
// ============================================

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  email: string;
  type: 'refresh';
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// ============================================
// Error Types
// ============================================

export class FileError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'FileError';
  }
}

// ============================================
// Share Token Types
// ============================================

export interface ShareTokenValidation {
  valid: boolean;
  fileId?: string;
  expiresAt?: Date;
  message?: string;
}

// ============================================
// Helper Functions
// ============================================

export function toFileRecord(dbRecord: DatabaseFileRecord): FileRecord {
  return {
    id: dbRecord.id,
    owner_id: dbRecord.owner_id,
    original_name: dbRecord.original_name,
    stored_name: dbRecord.stored_name,
    mime_type: dbRecord.mime_type,
    size_bytes: dbRecord.size_bytes,
    checksum_sha256: dbRecord.checksum_sha256,
    is_public: dbRecord.is_public,
    share_token: dbRecord.share_token,
    storage_key: dbRecord.storage_key,
    storage_type: dbRecord.storage_type as 'local' | 's3',
    created_at: dbRecord.created_at,
    updated_at: dbRecord.updated_at,
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateShareUrl(baseUrl: string, shareToken: string): string {
  return `${baseUrl}/share/${shareToken}`;
}

// ============================================
// Express Request Extension
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      file?: FileRecord; // For file middleware
    }
  }
}
