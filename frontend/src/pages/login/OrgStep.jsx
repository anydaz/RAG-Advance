import { useState } from "react";
import { checkOrg } from "../../api.js";
import Logo from "../../components/Logo.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";

export default function OrgStep({ onSuccess, theme, toggleTheme }) {
  const [orgSlug, setOrgSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const orgDomain = (orgSlug.trim() || "acme") + ".myco.app";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!orgSlug.trim()) return;
    setError("");
    setLoading(true);
    try {
      const org = await checkOrg(orgSlug.trim());
      onSuccess(org);
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
          Sign in to your workspace
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-dim mb-[30px]">
          Enter your organization ID to continue to the knowledge base.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <label className="text-[13px] font-medium text-ink-dim mb-2">
            Organization ID
          </label>
          <input
            className="w-full px-[15px] py-[13px] text-[15px] font-sans text-ink bg-surface border border-edge rounded-[11px] outline-none transition-[border,box-shadow] focus:border-accent focus:shadow-ring placeholder:text-ink-faint"
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            placeholder="acme"
            autoComplete="off"
            autoFocus
          />
          <div className="mt-[9px] text-[13px] text-ink-faint font-mono">
            {orgDomain}
          </div>

          {error && (
            <p className="mt-[10px] text-[13px] text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !orgSlug.trim()}
            className="mt-[26px] w-full py-[13px] text-[15px] font-semibold font-sans text-white bg-accent rounded-[11px] border-none cursor-pointer transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>

        <p className="mt-7 text-[13px] text-ink-faint text-center">
          Don&#39;t know your organization ID? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
