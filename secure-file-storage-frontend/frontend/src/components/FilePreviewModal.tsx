import { useEffect, useState } from "react";
import { FileTypeIcon } from "../utils/fileIcon";
import { formatBytes } from "../utils/format";
import { extractErrorMessage } from "../api/client";

const TEXT_PREVIEW_LIMIT = 200_000; // characters

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

function kindFor(mimeType: string): PreviewKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.startsWith("text/") ||
    ["application/json", "application/xml", "application/x-yaml"].includes(mimeType)
  )
    return "text";
  return "unsupported";
}

interface PreviewFile {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  file: PreviewFile;
  fetchBlob: () => Promise<Blob>;
  onDownload: () => void;
  onClose: () => void;
}

export function FilePreviewModal({ file, fetchBlob, onDownload, onClose }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const kind = kindFor(file.mimeType);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    (async () => {
      if (kind === "unsupported") {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const blob = await fetchBlob();
        if (cancelled) return;

        if (kind === "text") {
          const text = await blob.text();
          if (cancelled) return;
          setTextContent(text.slice(0, TEXT_PREVIEW_LIMIT));
        } else {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, "Couldn't load a preview for this file."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <FileTypeIcon mimeType={file.mimeType} name={file.originalName} size={38} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-bold text-slate-900" title={file.originalName}>
              {file.originalName}
            </h2>
            <p className="text-xs text-slate-400">{formatBytes(file.sizeBytes)}</p>
          </div>
          <button
            onClick={onDownload}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download
          </button>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {isLoading && (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">Loading preview…</div>
          )}

          {!isLoading && error && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-rose-600">{error}</p>
              <button
                onClick={onDownload}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition hover:bg-primary-700"
              >
                Download instead
              </button>
            </div>
          )}

          {!isLoading && !error && kind === "unsupported" && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <FileTypeIcon mimeType={file.mimeType} name={file.originalName} size={48} />
              <p className="text-sm text-slate-500">Preview isn't available for this file type.</p>
              <button
                onClick={onDownload}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition hover:bg-primary-700"
              >
                Download instead
              </button>
            </div>
          )}

          {!isLoading && !error && kind === "image" && objectUrl && (
            <img src={objectUrl} alt={file.originalName} className="mx-auto max-h-[65vh] w-auto rounded-lg object-contain" />
          )}

          {!isLoading && !error && kind === "pdf" && objectUrl && (
            <iframe title={file.originalName} src={objectUrl} className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white" />
          )}

          {!isLoading && !error && kind === "video" && objectUrl && (
            <video controls src={objectUrl} className="mx-auto max-h-[65vh] w-full rounded-lg bg-black" />
          )}

          {!isLoading && !error && kind === "audio" && objectUrl && (
            <div className="flex h-40 items-center justify-center">
              <audio controls src={objectUrl} className="w-full max-w-md" />
            </div>
          )}

          {!isLoading && !error && kind === "text" && textContent !== null && (
            <pre className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed whitespace-pre-wrap text-slate-700">
              {textContent}
            </pre>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3 sm:hidden">
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-600/20"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
