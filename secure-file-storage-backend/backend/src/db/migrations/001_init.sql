-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Files table - UPDATED with storage_key and storage_type
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name VARCHAR(1024) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum_sha256 VARCHAR(64),
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token VARCHAR(64) UNIQUE,
  
  -- OLD: storage_path (kept for backward compatibility)
  storage_path VARCHAR(1024),
  
  -- NEW: storage_key and storage_type
  storage_key VARCHAR(500) NOT NULL,
  storage_type VARCHAR(20) NOT NULL DEFAULT 'local',
  
  -- Optional: track downloads
  download_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);
CREATE INDEX IF NOT EXISTS idx_files_is_public ON files(is_public);
CREATE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);
CREATE INDEX IF NOT EXISTS idx_files_storage_type ON files(storage_type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- Optional: File shares table for tracking shared files
CREATE TABLE IF NOT EXISTS file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_token VARCHAR(100) UNIQUE NOT NULL,
  permissions VARCHAR(50) DEFAULT 'view', -- 'view', 'download', 'edit'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_by ON file_shares(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with ON file_shares(shared_with_user_id);

-- Optional: File download logs for analytics
CREATE TABLE IF NOT EXISTS file_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_downloads_file_id ON file_downloads(file_id);
CREATE INDEX IF NOT EXISTS idx_file_downloads_user_id ON file_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_downloads_downloaded_at ON file_downloads(downloaded_at DESC);

-- ============================================
-- MIGRATION: Update existing files table
-- ============================================

-- 1. Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='storage_key') THEN
    ALTER TABLE files ADD COLUMN storage_key VARCHAR(500);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='storage_type') THEN
    ALTER TABLE files ADD COLUMN storage_type VARCHAR(20) DEFAULT 'local';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='download_count') THEN
    ALTER TABLE files ADD COLUMN download_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Migrate existing data: Populate storage_key from storage_path
UPDATE files 
SET storage_key = REPLACE(storage_path, './storage/', ''),
    storage_type = 'local'
WHERE storage_key IS NULL AND storage_path IS NOT NULL;

-- 3. Make storage_key NOT NULL after migration
ALTER TABLE files ALTER COLUMN storage_key SET NOT NULL;

-- ============================================
-- Helper Views (Optional)
-- ============================================

-- View: File statistics by user
CREATE OR REPLACE VIEW user_file_stats AS
SELECT 
  u.id AS user_id,
  u.email,
  u.name,
  COUNT(f.id) AS total_files,
  COALESCE(SUM(f.size_bytes), 0) AS total_bytes,
  COALESCE(SUM(CASE WHEN f.is_public THEN 1 ELSE 0 END), 0) AS public_files,
  COALESCE(SUM(CASE WHEN NOT f.is_public THEN 1 ELSE 0 END), 0) AS private_files,
  COALESCE(SUM(f.download_count), 0) AS total_downloads
FROM users u
LEFT JOIN files f ON u.id = f.owner_id
GROUP BY u.id, u.email, u.name;

-- View: Recently uploaded files
CREATE OR REPLACE VIEW recent_files AS
SELECT 
  f.id,
  f.original_name,
  f.mime_type,
  f.size_bytes,
  f.is_public,
  f.storage_type,
  f.created_at,
  u.email AS owner_email,
  u.name AS owner_name
FROM files f
JOIN users u ON f.owner_id = u.id
ORDER BY f.created_at DESC
LIMIT 100;