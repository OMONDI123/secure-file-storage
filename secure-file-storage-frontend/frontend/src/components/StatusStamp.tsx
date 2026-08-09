export function StatusStamp({ isPublic }: { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700"
        title="Anyone with the link can view this file"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
        Public
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
      title="Only you can access this file"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Private
    </span>
  );
}
