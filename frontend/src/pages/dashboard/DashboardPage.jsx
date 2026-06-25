import { useState, useRef, useEffect } from "react";
import ThemeToggle from "../../components/ThemeToggle.jsx";

const CHAT_DATA = {
  roadmap: {
    q: "Summarize our Q3 product roadmap",
    sub: "Product · this quarter",
    a: "Q3 centers on three themes. First, the self-serve onboarding flow ships in July to reduce time-to-value for new accounts. Second, the analytics suite expands with cohort retention reporting, entering beta in August. Third, enterprise SSO with SAML support is hardened for general availability in late September, pending the security review.",
    sources: [
      { title: "Q3 Roadmap Brief", snippet: "Three pillars for the quarter: self-serve onboarding, analytics expansion, and enterprise SSO.", type: "Docs · Product" },
      { title: "Eng Planning — H2", snippet: "SAML general availability targeted for late September pending security review sign-off.", type: "Linear" },
      { title: "Analytics Beta Spec", snippet: "Cohort retention reporting ships to the beta cohort in August ahead of GA.", type: "Notion" },
    ],
  },
  pto: {
    q: "What's our PTO policy for new hires?",
    sub: "People Ops · benefits",
    a: "New hires begin accruing paid time off from their start date at a rate of 1.25 days per month, totaling 15 days in the first year. PTO becomes available to use after the 90-day onboarding period. Up to 5 unused days roll over into the next calendar year, and requests should be submitted at least two weeks in advance through the People Hub portal.",
    sources: [
      { title: "Employee Handbook 2026", snippet: "§4.2 — Paid time off accrues at 1.25 days per month for first-year employees.", type: "PDF · People Ops" },
      { title: "Onboarding Guide", snippet: "PTO unlocks once the 90-day onboarding milestone has been completed.", type: "Confluence" },
      { title: "Benefits Summary (US)", snippet: "Carryover is capped at 5 days per calendar year for all full-time staff.", type: "PDF" },
    ],
  },
  brand: {
    q: "Where are the latest brand guidelines?",
    sub: "Design · resources",
    a: "The current brand guidelines (v3, updated May 2026) live in the Brand workspace under Design Resources. They cover logo usage, the indigo-led color palette, the Hanken Grotesk type system, and voice-and-tone rules. Downloadable logo lockups, social templates, and color tokens are available from the linked asset library.",
    sources: [
      { title: "Brand Guidelines v3", snippet: "Updated May 2026 — logo usage, color, typography, and voice-and-tone standards.", type: "Figma" },
      { title: "Asset Library", snippet: "Downloadable logo lockups, social templates, and exported color tokens.", type: "Drive" },
    ],
  },
  access: {
    q: "How do I get access to the analytics dashboard?",
    sub: "IT · how-to",
    a: "Request access through the People Hub portal under IT Requests → Analytics. Approval is handled by your team lead and typically completes within one business day. Once granted, the dashboard appears under Tools → Analytics and signs you in automatically with your single sign-on credentials.",
    sources: [
      { title: "IT Access Runbook", snippet: "Analytics access requires team-lead approval submitted through People Hub.", type: "Confluence" },
      { title: "Tools Directory", snippet: "The analytics dashboard is reachable via SSO once your account is provisioned.", type: "Notion" },
    ],
  },
};

const GENERIC = {
  a: "I searched your organization's connected sources and pulled together the most relevant information below. The references cited reflect the documents with the strongest match to your question — open any of them to read the full context.",
  sources: [
    { title: "Company Knowledge Base", snippet: "Indexed articles, policies, and internal documentation across all teams.", type: "Internal" },
    { title: "Shared Drive", snippet: "Most-relevant matching documents from your connected file storage.", type: "Drive" },
  ],
};

function getInitials(username) {
  const parts = username.replace(/[_.\-]/g, " ").split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const SignOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

const UpArrowIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export default function ChatPage({ user, onLogout, theme, toggleTheme }) {
  const [isConversation, setIsConversation] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [assistantFull, setAssistantFull] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [streamingDone, setStreamingDone] = useState(false);
  const [sources, setSources] = useState([]);
  const [composer, setComposer] = useState("");
  const intervalRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function ask(question, answer, answerSources) {
    clearInterval(intervalRef.current);
    setIsConversation(true);
    setUserQuestion(question);
    setAssistantFull(answer);
    setRevealed(0);
    setStreaming(true);
    setStreamingDone(false);
    setSources(answerSources);
    setComposer("");

    const words = answer.split(" ");
    intervalRef.current = setInterval(() => {
      setRevealed((prev) => {
        const next = prev + 1;
        if (next >= words.length) {
          clearInterval(intervalRef.current);
          setStreaming(false);
          setStreamingDone(true);
          return words.length;
        }
        return next;
      });
    }, 42);
  }

  function newChat() {
    clearInterval(intervalRef.current);
    setIsConversation(false);
    setUserQuestion("");
    setAssistantFull("");
    setRevealed(0);
    setStreaming(false);
    setStreamingDone(false);
    setSources([]);
    setComposer("");
  }

  function sendComposer() {
    const text = composer.trim();
    if (!text) return;
    const key = Object.keys(CHAT_DATA).find((k) =>
      CHAT_DATA[k].q.toLowerCase().includes(text.toLowerCase().slice(0, 20))
    );
    if (key) ask(CHAT_DATA[key].q, CHAT_DATA[key].a, CHAT_DATA[key].sources);
    else ask(text, GENERIC.a, GENERIC.sources);
  }

  function handleComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendComposer();
    }
  }

  function autoResizeTextarea(e) {
    setComposer(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  const words = assistantFull.split(" ");
  const assistantText = words.slice(0, revealed).join(" ");
  const orgDomain = user.org + ".myco.app";
  const initials = getInitials(user.username);
  const headerTitle = isConversation ? userQuestion : "New chat";

  const suggested = Object.entries(CHAT_DATA).map(([key, d]) => ({
    key,
    title: d.q,
    sub: d.sub,
  }));

  const history = [
    {
      group: "Today",
      items: [
        { title: "PTO policy for new hires", key: "pto", active: isConversation && userQuestion === CHAT_DATA.pto.q },
        { title: "Q3 roadmap summary", key: "roadmap", active: isConversation && userQuestion === CHAT_DATA.roadmap.q },
      ],
    },
    {
      group: "Yesterday",
      items: [
        { title: "Brand guidelines location", key: "brand", active: false },
        { title: "Analytics access steps", key: "access", active: false },
        { title: "Expense report process", key: "pto", active: false },
      ],
    },
    {
      group: "Previous 7 days",
      items: [
        { title: "Onboarding checklist", key: "access", active: false },
        { title: "VPN setup for remote work", key: "roadmap", active: false },
        { title: "Security policy overview", key: "brand", active: false },
      ],
    },
  ];

  return (
    <div
      data-theme={theme}
      className="flex w-full h-screen bg-canvas text-ink font-sans transition-[background,color] duration-[250ms] ease-linear"
    >
      {/* ── Sidebar ── */}
      <aside className="w-[280px] shrink-0 bg-surface border-r border-edge flex flex-col h-full">
        {/* Org name */}
        <div className="px-4 pt-[18px] pb-[14px]">
          <div className="flex items-center gap-[10px] px-[10px] py-2 rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2">
            <div className="w-7 h-7 rounded-lg bg-accent shrink-0 flex items-center justify-center">
              <div className="w-[10px] h-[10px] bg-white rounded-[2px] rotate-45" />
            </div>
            <div className="min-w-0 leading-[1.2]">
              <div className="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                {user.org_display_name}
              </div>
              <div className="text-[11px] text-ink-faint font-mono">
                {orgDomain}
              </div>
            </div>
          </div>
        </div>

        {/* New chat */}
        <div className="px-4 pb-3">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-[9px] px-3 py-[10px] text-[14px] font-medium font-sans text-ink bg-surface border border-edge rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2 hover:border-edge-strong text-left"
          >
            <PlusIcon />
            New chat
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {history.map((group) => (
            <div key={group.group}>
              <div className="mx-2 mt-[10px] mb-1 text-[11px] font-semibold tracking-[0.04em] uppercase text-ink-faint">
                {group.group}
              </div>
              {group.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const d = CHAT_DATA[item.key];
                    ask(d.q, d.a, d.sources);
                  }}
                  className={`w-full text-left px-[10px] py-2 my-px rounded-lg text-[13.5px] font-sans border-none cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${
                    item.active
                      ? "bg-surface-2 text-ink font-semibold"
                      : "bg-transparent text-ink-dim hover:bg-surface-2"
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ))}
        </div>

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

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <header className="h-[54px] shrink-0 border-b border-edge flex items-center px-6">
          <div className="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
            {headerTitle}
          </div>
        </header>

        {/* ── Empty state ── */}
        {!isConversation && (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-[680px] flex flex-col items-center">
              <div className="w-[46px] h-[46px] rounded-xl bg-accent flex items-center justify-center shadow-accent-md mb-5">
                <div className="w-[17px] h-[17px] bg-white rounded-[4px] rotate-45" />
              </div>
              <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-center mb-[6px]">
                Good morning, {user.username.split(/[_.\-]/)[0]}
              </h2>
              <p className="text-[15px] text-ink-dim text-center mb-8">
                Ask anything about your company&#39;s documents and tools.
              </p>

              <div className="w-full grid grid-cols-2 gap-3">
                {suggested.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      const d = CHAT_DATA[p.key];
                      ask(d.q, d.a, d.sources);
                    }}
                    className="text-left px-4 py-[15px] bg-surface border border-edge rounded-[13px] cursor-pointer flex flex-col gap-[5px] font-sans transition-[border,transform,box-shadow] hover:border-edge-strong hover:shadow-card hover:-translate-y-px"
                  >
                    <span className="text-[14.5px] font-medium text-ink leading-[1.35]">
                      {p.title}
                    </span>
                    <span className="text-[12px] text-ink-faint font-mono">
                      {p.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Conversation ── */}
        {isConversation && (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-[720px] mx-auto flex flex-col gap-7">
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 bg-accent-soft text-ink rounded-[16px_16px_4px_16px] text-[15px] leading-relaxed">
                  {userQuestion}
                </div>
              </div>

              {/* Assistant response */}
              <div className="flex gap-[13px]">
                <div className="w-[30px] h-[30px] rounded-lg bg-accent shrink-0 flex items-center justify-center mt-[2px]">
                  <div className="w-[11px] h-[11px] bg-white rounded-[3px] rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] leading-[1.65] text-ink whitespace-pre-wrap">
                    {assistantText}
                    {streaming && (
                      <span className="inline-block w-2 h-4 bg-accent rounded-[2px] align-text-bottom ml-[2px] animate-blink" />
                    )}
                  </div>

                  {/* Sources */}
                  {streamingDone && sources.length > 0 && (
                    <div className="mt-5 animate-fade-up">
                      <div className="flex items-center gap-[7px] mb-[11px]">
                        <FileIcon />
                        <span className="text-[12px] font-semibold tracking-[0.03em] uppercase text-ink-faint">
                          {sources.length} sources
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-[10px]">
                        {sources.map((s, i) => (
                          <div
                            key={i}
                            className="px-[13px] py-3 bg-surface border border-edge rounded-[11px] cursor-pointer transition-[border,box-shadow] hover:border-edge-strong hover:shadow-card"
                          >
                            <div className="flex items-center gap-2 mb-[6px]">
                              <span className="w-[18px] h-[18px] shrink-0 rounded-[5px] bg-accent-soft text-accent-text text-[11px] font-semibold flex items-center justify-center font-mono">
                                {i + 1}
                              </span>
                              <span className="text-[13px] font-semibold text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                                {s.title}
                              </span>
                            </div>
                            <div className="text-[12px] leading-[1.45] text-ink-dim line-clamp-2">
                              {s.snippet}
                            </div>
                            <div className="mt-2 text-[11px] text-ink-faint font-mono">
                              {s.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Composer ── */}
        <div className="shrink-0 px-6 pb-[18px] pt-2">
          <div className="max-w-[720px] mx-auto">
            <div className="flex items-end gap-[10px] px-4 py-[10px] bg-surface border border-edge rounded-2xl shadow-card transition-[border] focus-within:border-accent">
              <textarea
                ref={textareaRef}
                value={composer}
                onChange={autoResizeTextarea}
                onKeyDown={handleComposerKey}
                rows={1}
                placeholder="Ask about policies, docs, roadmaps…"
                className="flex-1 resize-none border-none outline-none bg-transparent text-ink text-[15px] font-sans leading-relaxed py-[6px] max-h-[140px] placeholder:text-ink-faint"
              />
              <button
                onClick={sendComposer}
                aria-label="Send"
                className="w-9 h-9 shrink-0 rounded-[10px] bg-accent border-none text-white flex items-center justify-center cursor-pointer transition-colors hover:bg-accent-hover"
              >
                <UpArrowIcon />
              </button>
            </div>
            <p className="mt-[10px] text-[11.5px] text-center text-ink-faint">
              Answers are generated from your organization&#39;s connected knowledge base.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
