import { useState } from "react";
import type { FileItem } from "../types";
import { StatusStamp } from "./StatusStamp";
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
      <div className="rounded-lg border border-dashed border-ink-800 py-16 text-center">
        <p className="font-mono text-sm text-ink-500">The vault is empty. Deposit your first file above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-800">
      {error && (
        <p className="border-b border-rust-500/40 bg-rust-500/10 px-4 py-2 text-xs text-rust-400">{error}</p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink-800 bg-ink-900/60 font-mono text-[11px] uppercase tracking-widest text-ink-500">
            <th className="px-4 py-3 font-medium">Entry</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Size</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Deposited</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, i) => (
            <tr key={file.id} className="border-b border-ink-800/60 last:border-b-0 hover:bg-ink-900/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-600">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="truncate text-ink-100" title={file.originalName}>{file.originalName}</p>
                    <p className="truncate font-mono text-[11px] text-ink-500 sm:hidden">{formatBytes(file.sizeBytes)}</p>
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3 font-mono text-xs text-ink-400 sm:table-cell">{formatBytes(file.sizeBytes)}</td>
              <td className="hidden px-4 py-3 font-mono text-xs text-ink-400 md:table-cell">{formatDate(file.createdAt)}</td>
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
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                  <button
                    onClick={() => downloadOwnedFile(file)}
                    className="text-xs text-ink-300 underline-offset-2 hover:text-ink-50 hover:underline"
                  >
                    Download
                  </button>
                  {file.isPublic && file.shareUrl && (
                    <button
                      onClick={() => handleCopy(file)}
                      className="text-xs text-sage-400 underline-offset-2 hover:text-sage-300 hover:underline"
                    >
                      {copiedId === file.id ? "Copied!" : "Copy link"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(file)}
                    disabled={busyId === file.id}
                    className="text-xs text-rust-400 underline-offset-2 hover:text-rust-400/80 hover:underline disabled:opacity-50"
                  >
                    Delete
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
