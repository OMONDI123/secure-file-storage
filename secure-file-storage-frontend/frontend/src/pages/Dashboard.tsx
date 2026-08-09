import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";
import { FileUploadZone } from "../components/FileUploadZone";
import { FileLedger } from "../components/FileLedger";
import { listFiles } from "../api/files";
import { extractErrorMessage } from "../api/client";
import { formatBytes } from "../utils/format";
import type { FileItem } from "../types";

export default function Dashboard() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setFiles(await listFiles());
      } catch (err) {
        setError(extractErrorMessage(err, "Couldn't load your files."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleUploaded = (file: FileItem) => setFiles((prev) => [file, ...prev]);
  const handleChanged = (file: FileItem) => setFiles((prev) => prev.map((f) => (f.id === file.id ? file : f)));
  const handleDeleted = (fileId: string) => setFiles((prev) => prev.filter((f) => f.id !== fileId));

  const stats = useMemo(() => {
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    const publicCount = files.filter((f) => f.isPublic).length;
    return { total: files.length, totalBytes, publicCount };
  }, [files]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Your files</h1>
          <p className="mt-1 text-sm text-slate-500">Upload, organize, and control who can see your files.</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary-600">
                <path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm9 0v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-display text-xl font-extrabold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Total files</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gold-600">
                <path d="M12 2a5 5 0 015 5v3h1a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h1V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v3h6V7a3 3 0 00-3-3z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="font-display text-xl font-extrabold text-slate-900">{formatBytes(stats.totalBytes)}</p>
              <p className="text-xs text-slate-500">Storage used</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-violet-600">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2.1 2.1M8.6 15.4l-2.1 2.1m0-11L8.6 8.6m6.8 6.8l2.1 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-display text-xl font-extrabold text-slate-900">{stats.publicCount}</p>
              <p className="text-xs text-slate-500">Shared publicly</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <FileUploadZone onUploaded={handleUploaded} />
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading your files…</p>
        ) : (
          <FileLedger files={files} onChanged={handleChanged} onDeleted={handleDeleted} />
        )}
      </main>
    </div>
  );
}
