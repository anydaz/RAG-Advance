const MoonIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export default function ThemeToggle({ theme, onToggle, className = "", small = false }) {
  const size = small ? "w-8 h-8 rounded-lg" : "w-[38px] h-[38px] rounded-[10px]";
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className={`${size} ${className} flex items-center justify-center border border-edge bg-surface text-ink-dim cursor-pointer transition-colors hover:border-edge-strong hover:text-ink shrink-0`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
