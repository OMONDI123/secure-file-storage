import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { FileUploadZone } from "../components/FileUploadZone";
import { FileLedger } from "../components/FileLedger";
import { listFiles } from "../api/files";
import { extractErrorMessage } from "../api/client";
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-ink-50">Your ledger</h1>
          <p className="mt-1 text-sm text-ink-400">
            {files.length} file{files.length === 1 ? "" : "s"} on deposit
          </p>
        </div>

        <div className="mb-8">
          <FileUploadZone onUploaded={handleUploaded} />
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-rust-500/40 bg-rust-500/10 px-3 py-2 text-xs text-rust-400">{error}</p>
        )}

        {isLoading ? (
          <p className="font-mono text-sm text-ink-500">Loading ledger…</p>
        ) : (
          <FileLedger files={files} onChanged={handleChanged} onDeleted={handleDeleted} />
        )}
      </main>
    </div>
  );
}
