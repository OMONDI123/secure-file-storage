type Kind = "image" | "pdf" | "archive" | "doc" | "sheet" | "other";

function kindFor(mimeType: string, name: string): Kind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("compressed") || ["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return "archive";
  if (mimeType.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext)) return "sheet";
  if (mimeType.includes("word") || mimeType.includes("document") || ["doc", "docx", "txt", "md"].includes(ext))
    return "doc";
  return "other";
}

const STYLES: Record<Kind, { bg: string; fg: string }> = {
  image: { bg: "var(--color-gold-100)", fg: "var(--color-gold-600)" },
  pdf: { bg: "var(--color-rose-100)", fg: "var(--color-rose-600)" },
  archive: { bg: "var(--color-violet-100)", fg: "var(--color-violet-600)" },
  sheet: { bg: "var(--color-primary-100)", fg: "var(--color-primary-600)" },
  doc: { bg: "var(--color-blue-100)", fg: "var(--color-blue-600)" },
  other: { bg: "var(--color-slate-100)", fg: "var(--color-slate-500)" },
};

const PATHS: Record<Kind, string> = {
  image: "M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2 12l4.5-5 3 3.2L17 12l3 6H6z M8.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  pdf: "M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm9 0v5h5 M8 13h1.5a1.5 1.5 0 010 3H8v-3zm0 3v2m5-5v5m0-5h1.7a1.3 1.3 0 010 2.6H13m4.5-2.6V16",
  archive: "M4 4h16v4H4V4zm1 4h14v12H5V8zm5 3h4v2h-4v-2z",
  sheet: "M4 4h16v16H4V4zm0 5h16M4 14h16M9 4v16M14 4v16",
  doc: "M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm9 0v5h5M8 13h8M8 16.5h8M8 9.5h3",
  other: "M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm9 0v5h5",
};

export function FileTypeIcon({ mimeType, name, size = 36 }: { mimeType: string; name: string; size?: number }) {
  const kind = kindFor(mimeType, name);
  const { bg, fg } = STYLES[kind];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d={PATHS[kind]} stroke={fg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
