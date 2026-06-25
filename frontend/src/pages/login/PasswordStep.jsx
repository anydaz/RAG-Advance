import { useState } from "react";
import { login } from "../../api.js";
import Logo from "../../components/Logo.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";

export default function PasswordStep({ org, onSuccess, onBack, theme, toggleTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const orgDomain = org.org_slug + ".myco.app";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(org.org_slug, username.trim(), password);
      onSuccess(data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <ThemeToggle theme={theme} onToggle={toggleTheme} className="absolute top-6 right-6" />

      <div className="w-full max-w-[392px] flex flex-col">
        <Logo />

        <h1 className="text-[25px] font-semibold tracking-[-0.02em] mb-2">
          Welcome back
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-dim mb-[22px]">
          Sign in to continue.
        </p>

        {/* Org badge */}
        <div className="flex items-center justify-between gap-[10px] px-3 py-[9px] bg-surface-2 border border-edge rounded-[10px] mb-6">
          <div className="flex items-center gap-[9px] min-w-0">
            <div className="w-[22px] h-[22px] rounded-[6px] bg-accent shrink-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-[2px] rotate-45" />
            </div>
            <span className="text-[14px] font-medium font-mono whitespace-nowrap overflow-hidden text-ellipsis">
              {orgDomain}
            </span>
          </div>
          <button
            onClick={onBack}
            className="text-[13px] font-medium text-accent-text bg-transparent border-none cursor-pointer shrink-0 p-0 hover:underline"
          >
            Change
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <label className="text-[13px] font-medium text-ink-dim mb-2">
            Username
          </label>
          <input
            className="w-full px-[15px] py-[13px] mb-[18px] text-[15px] font-sans text-ink bg-surface border border-edge rounded-[11px] outline-none transition-[border,box-shadow] focus:border-accent focus:shadow-ring placeholder:text-ink-faint"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@acme.com"
            autoComplete="off"
            autoFocus
          />

          <label className="text-[13px] font-medium text-ink-dim mb-2">
            Password
          </label>
          <input
            className="w-full px-[15px] py-[13px] text-[15px] font-sans text-ink bg-surface border border-edge rounded-[11px] outline-none transition-[border,box-shadow] focus:border-accent focus:shadow-ring placeholder:text-ink-faint"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />

          {error && (
            <p className="mt-[10px] text-[13px] text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-[26px] w-full py-[13px] text-[15px] font-semibold font-sans text-white bg-accent rounded-[11px] border-none cursor-pointer transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
