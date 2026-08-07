export function StatusStamp({ isPublic }: { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className="inline-flex -rotate-3 items-center gap-1.5 rounded-sm border-2 border-sage-400/70 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-sage-400"
        title="Anyone with the link can view this file"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-sage-400" />
        Shared
      </span>
    );
  }
  return (
    <span
      className="inline-flex -rotate-3 items-center gap-1.5 rounded-sm border-2 border-brass-400/70 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-brass-400"
      title="Only you can access this file"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-brass-400" />
      Sealed
    </span>
  );
}
