import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" className="mb-3">
            <circle cx="16" cy="16" r="11" stroke="var(--color-brass-400)" strokeWidth="2" />
            <circle cx="16" cy="16" r="2" fill="var(--color-brass-400)" />
            <line x1="16" y1="7" x2="16" y2="10.5" stroke="var(--color-brass-400)" strokeWidth="2" />
          </svg>
          <h1 className="font-mono text-xl font-semibold tracking-tight text-ink-50">{title}</h1>
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-6">{children}</div>
      </div>
    </div>
  );
}
