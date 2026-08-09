import { useCallback, useRef, useState } from "react";
import { uploadFile } from "../api/files";
import { extractErrorMessage } from "../api/client";
import { ProgressDial } from "./ProgressDial";
import type { FileItem } from "../types";

const MAX_FILE_SIZE_MB = 120;

interface Props {
  onUploaded: (file: FileItem) => void;
}

type UploadState = { status: "idle" } | { status: "uploading"; percent: number; name: string } | { status: "error"; message: string };

export function FileUploadZone({ onUploaded }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_FILE_SIZE_MB) {
        setState({ status: "error", message: `"${file.name}" is ${sizeMb.toFixed(1)}MB — the limit is ${MAX_FILE_SIZE_MB}MB.` });
        return;
      }

      setState({ status: "uploading", percent: 0, name: file.name });
      try {
        const uploaded = await uploadFile(file, isPublic, (percent) => {
          setState({ status: "uploading", percent, name: file.name });
        });
        onUploaded(uploaded);
        setState({ status: "idle" });
      } catch (err) {
        setState({ status: "error", message: extractErrorMessage(err, "Upload failed. Please try again.") });
      }
    },
    [isPublic, onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-slate-900">Upload a file</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded accent-primary-600"
          />
          Make public on upload
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => state.status !== "uploading" && inputRef.current?.click()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-slate-50/60 hover:border-primary-300 hover:bg-primary-50/40"
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={onSelect} />

        {state.status === "uploading" ? (
          <>
            <ProgressDial percent={state.percent} label="uploading" />
            <p className="max-w-xs truncate text-sm text-slate-500">{state.name}</p>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary-600">
                <path d="M12 16V4M12 4L7 9M12 4l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-slate-600">
              Drag a file here, or <span className="font-semibold text-primary-600">browse</span>
            </p>
            <p className="text-xs text-slate-400">Up to {MAX_FILE_SIZE_MB}MB per file</p>
          </>
        )}
      </div>

      {state.status === "error" && (
        <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{state.message}</p>
      )}
    </div>
  );
}
