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
  storage_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}
