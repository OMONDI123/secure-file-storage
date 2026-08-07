import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicFile } from "../api/files";
import { extractErrorMessage } from "../api/client";
import { formatBytes, formatDate } from "../utils/format";
import type { FileItem } from "../types";

export default function PublicFile() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<FileItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setFile(await getPublicFile(token));
      } catch (err) {
        setError(extractErrorMessage(err, "This shared file could not be found."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="11" stroke="var(--color-sage-400)" strokeWidth="2" />
            <circle cx="16" cy="16" r="2" fill="var(--color-sage-400)" />
            <line x1="16" y1="7" x2="16" y2="10.5" stroke="var(--color-sage-400)" strokeWidth="2" />
          </svg>
        </div>

        {isLoading && <p className="text-center font-mono text-sm text-ink-500">Retrieving shared file…</p>}

        {error && (
          <div className="rounded-lg border border-rust-500/40 bg-rust-500/10 p-6 text-center">
            <p className="text-sm text-rust-400">{error}</p>
          </div>
        )}

        {file && (
          <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-6">
            <span className="mb-3 inline-flex -rotate-3 items-center gap-1.5 rounded-sm border-2 border-sage-400/70 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-sage-400">
              Shared file
            </span>
            <h1 className="mb-1 break-words font-mono text-lg font-semibold text-ink-50">{file.originalName}</h1>
            <p className="mb-4 font-mono text-xs text-ink-500">
              {formatBytes(file.sizeBytes)} · deposited {formatDate(file.createdAt)}
            </p>
            <a
              href={file.publicDownloadUrl ?? undefined}
              className="block w-full rounded-md bg-sage-500 px-4 py-2.5 text-center text-sm font-semibold text-ink-950 transition hover:bg-sage-400"
            >
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
