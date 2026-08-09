import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : user?.email?.[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-gold-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3l7 2.6v4.8c0 4.3-2.8 7.7-7 8.6-4.2-.9-7-4.3-7-8.6V5.6L12 3z"
                fill="white"
              />
              <path d="M9.3 12.1l1.8 1.8 3.5-3.8" stroke="var(--color-primary-600)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">Vault</span>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-[11px] font-bold text-white">
                {initials}
              </span>
              <span className="text-sm font-medium text-slate-700">{user.name || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
