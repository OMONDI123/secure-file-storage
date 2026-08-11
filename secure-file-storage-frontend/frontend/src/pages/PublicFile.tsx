import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicFile } from "../api/files";
import { extractErrorMessage } from "../api/client";
import { formatBytes, formatDate } from "../utils/format";
import { FileTypeIcon } from "../utils/fileIcon";
import type { FileItem } from "../types";

export default function PublicFile() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<FileItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      console.log('[PublicFile] No token provided');
      setIsLoading(false);
      return;
    }

    console.log('[PublicFile] Fetching file for token:', token);

    (async () => {
      try {
        const fileData = await getPublicFile(token);
        console.log('[PublicFile] File data received:', fileData);
        setFile(fileData);
      } catch (err) {
        console.error('[PublicFile] Error:', err);
        setError(extractErrorMessage(err, "This shared file could not be found."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <p className="text-center text-sm text-slate-500">Retrieving shared file…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">File not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold-100 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-gold-400 shadow-lg shadow-primary-500/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 2.6v4.8c0 4.3-2.8 7.7-7 8.6-4.2-.9-7-4.3-7-8.6V5.6L12 3z" fill="white" />
              <path d="M9.3 12.1l1.8 1.8 3.5-3.8" stroke="var(--color-primary-600)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            Shared file
          </span>
          <div className="mb-4 flex items-center gap-3">
            <FileTypeIcon mimeType={file.mimeType} name={file.originalName} size={42} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-slate-900">{file.originalName}</h1>
              <p className="text-xs text-slate-400">
                {formatBytes(file.sizeBytes)} · uploaded {formatDate(file.createdAt)}
              </p>
            </div>
          </div>
          <a
            href={file.publicDownloadUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition hover:bg-primary-700"
          >
            Download file
          </a>
        </div>
      </div>
    </div>
  );
}