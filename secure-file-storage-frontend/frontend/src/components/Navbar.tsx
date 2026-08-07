import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="10" stroke="var(--color-brass-400)" strokeWidth="2" />
            <circle cx="16" cy="16" r="2" fill="var(--color-brass-400)" />
            <line x1="16" y1="8" x2="16" y2="11" stroke="var(--color-brass-400)" strokeWidth="2" />
          </svg>
          <span className="font-mono text-lg font-semibold tracking-tight text-ink-50">VAULT</span>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-ink-400 sm:inline">{user.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-200 transition hover:border-ink-500 hover:text-ink-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
