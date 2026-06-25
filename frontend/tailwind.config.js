/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Hanken Grotesk'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        canvas: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          faint: "var(--text-faint)",
        },
        edge: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          text: "var(--accent-text)",
        },
      },
      boxShadow: {
        card: "var(--shadow)",
        ring: "0 0 0 4px var(--ring)",
        "accent-sm": "0 2px 8px var(--ring)",
        "accent-md": "0 4px 14px var(--ring)",
      },
      animation: {
        "fade-up": "fadeUp 0.35s ease both",
        blink: "blink 1s steps(1) infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
