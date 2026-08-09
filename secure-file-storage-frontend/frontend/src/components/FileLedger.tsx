import { useState } from "react";
import type { FileItem } from "../types";
import { StatusStamp } from "./StatusStamp";
import { FileTypeIcon } from "../utils/fileIcon";
import { formatBytes, formatDate } from "../utils/format";
import { deleteFile, setVisibility, downloadOwnedFile } from "../api/files";
import { extractErrorMessage } from "../api/client";

interface Props {
  files: FileItem[];
  onChanged: (file: FileItem) => void;
  onDeleted: (fileId: string) => void;
}

export function FileLedger({ files, onChanged, onDeleted }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (file: FileItem) => {
    setBusyId(file.id);
    setError(null);
    try {
      const updated = await setVisibility(file.id, !file.isPublic);
      onChanged(updated);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't update visibility."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Permanently delete "${file.originalName}"? This can't be undone.`)) return;
    setBusyId(file.id);
    setError(null);
    try {
      await deleteFile(file.id);
      onDeleted(file.id);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't delete this file."));
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = (file: FileItem) => {
    if (!file.shareUrl) return;
    navigator.clipboard.writeText(file.shareUrl);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary-500">
            <path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">No files yet — upload your first one above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {error && (
        <p className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3 font-semibold">File</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Size</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Uploaded</th>
            <th className="px-4 py-3 font-semibold">Visibility</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <FileTypeIcon mimeType={file.mimeType} name={file.originalName} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800" title={file.originalName}>{file.originalName}</p>
                    <p className="truncate text-xs text-slate-400 sm:hidden">{formatBytes(file.sizeBytes)}</p>
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{formatBytes(file.sizeBytes)}</td>
              <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{formatDate(file.createdAt)}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleToggle(file)}
                  disabled={busyId === file.id}
                  className="disabled:opacity-50"
                  title="Toggle public / private"
                >
                  <StatusStamp isPublic={file.isPublic} />
                </button>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                  <button
                    onClick={() => downloadOwnedFile(file)}
                    title="Download"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {file.isPublic && file.shareUrl && (
                    <button
                      onClick={() => handleCopy(file)}
                      title="Copy share link"
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate-500 transition hover:bg-violet-50 hover:text-violet-600"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12a3 3 0 003 3l3-3a3 3 0 000-4.2L14 6.7M15 12a3 3 0 00-3-3l-3 3a3 3 0 000 4.2L10 17.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {copiedId === file.id && <span className="text-xs font-semibold text-violet-600">Copied</span>}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(file)}
                    disabled={busyId === file.id}
                    title="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
