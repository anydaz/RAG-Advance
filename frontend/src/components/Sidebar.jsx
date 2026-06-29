import { useNavigate, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SignOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

function getInitials(username) {
  const parts = username.replace(/[_.\-]/g, " ").split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export default function Sidebar({ user, onLogout, theme, toggleTheme, onNewChat, children, isOpen, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = pathname === "/admin";
  const orgDomain = user.org + ".myco.app";
  const initials = getInitials(user.username);

  function handleNewChat() {
    if (onNewChat) onNewChat();
    if (onClose) onClose();
    navigate("/");
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 bg-surface border-r border-edge flex flex-col h-full
      transition-transform duration-300 ease-in-out
      ${isOpen ? "translate-x-0" : "-translate-x-full"}
      md:relative md:translate-x-0 md:z-auto
    `}>
      {/* Org header */}
      <div className="px-4 pt-[18px] pb-[14px]">
        <div className="flex items-center gap-[10px] px-[10px] py-2 rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2">
          <div className="w-7 h-7 rounded-lg bg-accent shrink-0 flex items-center justify-center">
            <div className="w-[10px] h-[10px] bg-white rounded-[2px] rotate-45" />
          </div>
          <div className="min-w-0 leading-[1.2]" onClick={() => navigate("/")}>
            <div className="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
              {user.org_display_name}
            </div>
            <div className="text-[11px] text-ink-faint font-mono">{orgDomain}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-4 pb-3 flex flex-col gap-[6px]">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-[9px] px-3 py-[10px] text-[14px] font-medium font-sans text-ink bg-surface border border-edge rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2 hover:border-edge-strong text-left"
        >
          <PlusIcon />
          New chat
        </button>
        <button
          onClick={() => navigate("/admin")}
          className={`w-full flex items-center gap-[9px] px-3 py-[10px] text-[14px] font-sans border border-transparent rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2 text-left ${
            isAdmin
              ? "font-semibold text-accent-text bg-surface-2"
              : "font-medium text-ink bg-transparent"
          }`}
        >
          <ShieldIcon />
          Admin
        </button>
      </div>

      {/* Page-specific slot (e.g. chat history) */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">{children}</div>

      {/* User row */}
      <div className="border-t border-edge p-3 flex items-center gap-[10px]">
        <div className="w-[30px] h-[30px] rounded-full bg-accent-soft text-accent-text shrink-0 flex items-center justify-center text-[13px] font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0 leading-[1.2]">
          <div className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
            {user.username}
          </div>
          <div className="text-[11px] text-ink-faint">Member</div>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} small />
        <button
          onClick={onLogout}
          aria-label="Sign out"
          className="w-8 h-8 flex items-center justify-center border border-edge bg-surface text-ink-dim rounded-lg cursor-pointer transition-colors hover:border-edge-strong hover:text-ink shrink-0"
        >
          <SignOutIcon />
        </button>
      </div>
    </aside>
    </>
  );
}
