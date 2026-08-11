import { api } from "./client";
import type { FileItem } from "../types";

export async function listFiles(): Promise<FileItem[]> {
  const res = await api.get("/api/files");
  return res.data.files;
}

export async function uploadFile(
  file: File,
  isPublic: boolean,
  onProgress: (percent: number) => void
): Promise<FileItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("isPublic", String(isPublic));

  const res = await api.post("/api/files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return res.data.file;
}

export async function setVisibility(fileId: string, isPublic: boolean): Promise<FileItem> {
  const res = await api.patch(`/api/files/${fileId}/visibility`, { isPublic });
  return res.data.file;
}

export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/api/files/${fileId}`);
}

export async function getPublicFile(token: string): Promise<FileItem> {
  console.log(`[API] Fetching public file for token: ${token}`);
  
  const res = await api.get(`/api/files/public/${token}`);
  console.log('[API] Public file response:', res.data);
  
  // The backend returns { file: { ... } }
  const fileData = res.data.file;
  
  // Ensure the file object has the correct structure
  return {
    id: fileData.id,
    originalName: fileData.originalName,
    mimeType: fileData.mimeType,
    sizeBytes: fileData.sizeBytes,
    checksumSha256: fileData.checksumSha256 || null,
    isPublic: fileData.isPublic,
    shareUrl: fileData.shareUrl || null,
    publicDownloadUrl: fileData.publicDownloadUrl || null,
    downloadUrl: fileData.downloadUrl || '',
    createdAt: fileData.createdAt,
    updatedAt: fileData.updatedAt,
  };
}

export async function downloadOwnedFile(file: FileItem): Promise<void> {
  const res = await api.get(`/api/files/${file.id}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}