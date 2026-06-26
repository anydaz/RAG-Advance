import { useState, useRef, useEffect } from "react";
import Sidebar from "../../components/Sidebar.jsx";
import { sendChat } from "../../api.js";

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const UpArrowIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const SUGGESTIONS = [
  { title: "Summarize our Q3 product roadmap", sub: "Product · this quarter" },
  { title: "What's our PTO policy for new hires?", sub: "People Ops · benefits" },
  { title: "Where are the latest brand guidelines?", sub: "Design · resources" },
  { title: "How do I get access to the analytics dashboard?", sub: "IT · how-to" },
];

export default function DashboardPage({ user, onLogout, theme, toggleTheme }) {
  const [isConversation, setIsConversation] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingDone, setStreamingDone] = useState(false);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [composer, setComposer] = useState("");

  const abortRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => () => { if (abortRef.current) abortRef.current = true; }, []);

  async function ask(question) {
    if (streaming) return;

    abortRef.current = false;
    setIsConversation(true);
    setUserQuestion(question);
    setAssistantText("");
    setSources([]);
    setStreaming(true);
    setStreamingDone(false);
    setError(null);
    setComposer("");

    try {
      await sendChat(user.org, question, (event) => {
        if (abortRef.current) return;
        if (event.type === "sources") {
          setSources(event.sources ?? []);
        } else if (event.type === "token") {
          setAssistantText((prev) => prev + (event.text ?? ""));
        } else if (event.type === "done") {
          setStreaming(false);
          setStreamingDone(true);
        }
      });
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message);
        setStreaming(false);
        setStreamingDone(true);
      }
    }
  }

  function newChat() {
    abortRef.current = true;
    setIsConversation(false);
    setUserQuestion("");
    setAssistantText("");
    setStreaming(false);
    setStreamingDone(false);
    setSources([]);
    setError(null);
    setComposer("");
  }

  function sendComposer() {
    const text = composer.trim();
    if (!text || streaming) return;
    ask(text);
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

  return (
    <div
      data-theme={theme}
      className="flex w-full h-screen bg-canvas text-ink font-sans transition-[background,color] duration-[250ms] ease-linear"
    >
      <Sidebar
        user={user}
        onLogout={onLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        onNewChat={newChat}
      />

      <main className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-[54px] shrink-0 border-b border-edge flex items-center px-6">
          <div className="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
            {isConversation ? userQuestion : "New chat"}
          </div>
        </header>

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
                {SUGGESTIONS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => ask(p.title)}
                    className="text-left px-4 py-[15px] bg-surface border border-edge rounded-[13px] cursor-pointer flex flex-col gap-[5px] font-sans transition-[border,transform,box-shadow] hover:border-edge-strong hover:shadow-card hover:-translate-y-px"
                  >
                    <span className="text-[14.5px] font-medium text-ink leading-[1.35]">{p.title}</span>
                    <span className="text-[12px] text-ink-faint font-mono">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isConversation && (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-[720px] mx-auto flex flex-col gap-7">
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 bg-accent-soft text-ink rounded-[16px_16px_4px_16px] text-[15px] leading-relaxed">
                  {userQuestion}
                </div>
              </div>
              <div className="flex gap-[13px]">
                <div className="w-[30px] h-[30px] rounded-lg bg-accent shrink-0 flex items-center justify-center mt-[2px]">
                  <div className="w-[11px] h-[11px] bg-white rounded-[3px] rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  {error ? (
                    <div
                      className="px-4 py-3 rounded-[10px] text-[13.5px] font-medium"
                      style={{ color: "#c0392e", background: "rgba(192,57,46,0.08)" }}
                    >
                      {error}
                    </div>
                  ) : (
                    <div className="text-[15px] leading-[1.65] text-ink whitespace-pre-wrap">
                      {assistantText || (streaming && (
                        <span className="inline-block w-2 h-4 bg-accent rounded-[2px] align-text-bottom animate-blink" />
                      ))}
                      {assistantText && streaming && (
                        <span className="inline-block w-2 h-4 bg-accent rounded-[2px] align-text-bottom ml-[2px] animate-blink" />
                      )}
                    </div>
                  )}
                  {streamingDone && sources.length > 0 && (
                    <div className="mt-5 animate-fade-up">
                      <div className="flex items-center gap-[7px] mb-[11px]">
                        <FileIcon />
                        <span className="text-[12px] font-semibold tracking-[0.03em] uppercase text-ink-faint">
                          {sources.length} source{sources.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-[10px]">
                        {sources.map((s, i) => {
                          const pages = s.page_numbers?.length
                            ? `Page${s.page_numbers.length > 1 ? "s" : ""} ${s.page_numbers.join(", ")}`
                            : null;
                          const inner = (
                            <>
                              <div className="flex items-center gap-2 mb-[6px]">
                                <span className="w-[18px] h-[18px] shrink-0 rounded-[5px] bg-accent-soft text-accent-text text-[11px] font-semibold flex items-center justify-center font-mono">
                                  {i + 1}
                                </span>
                                <span className="text-[13px] font-semibold text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                                  {s.filename}
                                </span>
                              </div>
                              {pages && (
                                <div className="mt-1 text-[11px] text-ink-faint font-mono">{pages}</div>
                              )}
                            </>
                          );
                          const cls = "px-[13px] py-3 bg-surface border border-edge rounded-[11px] transition-[border,box-shadow]";
                          return s.url ? (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cls + " block hover:border-edge-strong hover:shadow-card"}
                            >
                              {inner}
                            </a>
                          ) : (
                            <div key={i} className={cls}>
                              {inner}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
                disabled={streaming || !composer.trim()}
                aria-label="Send"
                className="w-9 h-9 shrink-0 rounded-[10px] bg-accent border-none text-white flex items-center justify-center cursor-pointer transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
