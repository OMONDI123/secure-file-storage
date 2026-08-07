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
  const res = await api.get(`/api/files/public/${token}`);
  return res.data.file;
}

/**
 * Downloads a file the current user owns. A plain <a href> can't carry the
 * Authorization header, so this fetches the bytes as a blob (with the JWT
 * attached by the axios interceptor) and triggers a save via an object URL.
 */
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
