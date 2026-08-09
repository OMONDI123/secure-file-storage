import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold-100 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-violet-100 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-500 to-gold-400 shadow-lg shadow-primary-500/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 2.6v4.8c0 4.3-2.8 7.7-7 8.6-4.2-.9-7-4.3-7-8.6V5.6L12 3z" fill="white" />
              <path d="M9.3 12.1l1.8 1.8 3.5-3.8" stroke="var(--color-primary-600)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5">{children}</div>
      </div>
    </div>
  );
}
