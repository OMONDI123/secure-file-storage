// types/index.ts

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
  size_bytes: string;
  checksum_sha256: string | null;
  is_public: boolean;
  share_token: string | null;
  storage_path: string;
  storage_type?: string;
  created_at: Date;
  updated_at: Date;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  isPublic: boolean;
  shareToken: string | null;
  storagePath: string;
  storageType?: 'local' | 's3';
  userId?: string;  // Optional for ownership tracking
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}