export interface User {
  id: string;
  email: string;
  name: string;
}

export interface FileItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  isPublic: boolean;
  shareUrl: string | null;
  publicDownloadUrl: string | null; 
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorShape {
  error: {
    message: string;
    details?: unknown;
  };
}