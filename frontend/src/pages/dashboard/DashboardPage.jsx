import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "../../components/Sidebar.jsx";
import { sendChat, listSessions, getMessages, deleteSession } from "../../api.js";

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

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const SUGGESTIONS = [
  { title: "Summarize our Q3 product roadmap", sub: "Product · this quarter" },
  { title: "What's our PTO policy for new hires?", sub: "People Ops · benefits" },
  { title: "Where are the latest brand guidelines?", sub: "Design · resources" },
  { title: "How do I get access to the analytics dashboard?", sub: "IT · how-to" },
];

function groupSessionsByDate(sessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const sevenDaysAgo = new Date(today - 7 * 86400000);

  const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (d >= today) groups["Today"].push(s);
    else if (d >= yesterday) groups["Yesterday"].push(s);
    else if (d >= sevenDaysAgo) groups["Previous 7 days"].push(s);
    else groups["Older"].push(s);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export default function DashboardPage({ user, onLogout, theme, toggleTheme }) {
  const queryClient = useQueryClient();
  const sessionsKey = ["sessions", user.org, user.username];

  const { data: sessions = [] } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => listSessions(user.org, user.username),
  });

  const { mutate: removeSession } = useMutation({
    mutationFn: (id) => deleteSession(user.org, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: sessionsKey });
      const prev = queryClient.getQueryData(sessionsKey) ?? [];
      queryClient.setQueryData(sessionsKey, prev.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => queryClient.setQueryData(sessionsKey, ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });

  // Conversation state
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // { role, content, sources }
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSources, setStreamingSources] = useState([]);
  const [error, setError] = useState(null);
  const [composer, setComposer] = useState("");

  const abortRef = useRef(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const isConversation = messages.length > 0 || streaming;
  const activeTitle = sessions.find((s) => s.id === sessionId)?.title ?? (isConversation ? "New chat" : "New chat");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  function newChat() {
    abortRef.current = true;
    setSessionId(null);
    setMessages([]);
    setStreaming(false);
    setStreamingText("");
    setStreamingSources([]);
    setError(null);
    setComposer("");
  }

  async function loadSession(session) {
    newChat();
    abortRef.current = false;
    setSessionId(session.id);
    try {
      const msgs = await getMessages(user.org, session.id);
      setMessages(msgs.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources ?? [],
      })));
    } catch (e) {
      setError(e.message);
    }
  }

  async function ask(question) {
    if (streaming) return;
    abortRef.current = false;

    const optimisticMsg = { role: "user", content: question, sources: [] };
    setMessages((prev) => [...prev, optimisticMsg]);
    setStreaming(true);
    setStreamingText("");
    setStreamingSources([]);
    setError(null);
    setComposer("");

    let currentSessionId = sessionId;

    try {
      await sendChat(user.org, user.username, question, currentSessionId, (event) => {
        if (abortRef.current) return;
        if (event.type === "session") {
          currentSessionId = event.session_id;
          setSessionId(event.session_id);
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        } else if (event.type === "sources") {
          setStreamingSources(event.sources ?? []);
        } else if (event.type === "token") {
          setStreamingText((prev) => prev + (event.text ?? ""));
        } else if (event.type === "done") {
          setStreaming(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: streamingTextRef.current, sources: streamingSourcesRef.current },
          ]);
          setStreamingText("");
          setStreamingSources([]);
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        }
      });
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message);
        setStreaming(false);
      }
    }
  }

  // Keep refs in sync so the done handler captures current values
  const streamingTextRef = useRef("");
  const streamingSourcesRef = useRef([]);
  useEffect(() => { streamingTextRef.current = streamingText; }, [streamingText]);
  useEffect(() => { streamingSourcesRef.current = streamingSources; }, [streamingSources]);

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

  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div
      data-theme={theme}
      className="flex w-full h-screen bg-canvas text-ink font-sans transition-[background,color] duration-[250ms] ease-linear"
    >
      <Sidebar user={user} onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} onNewChat={newChat}>
        {groupedSessions.map(([group, items]) => (
          <div key={group}>
            <div className="mx-2 mt-[10px] mb-1 text-[11px] font-semibold tracking-[0.04em] uppercase text-ink-faint">
              {group}
            </div>
            {items.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-1 mx-px my-px rounded-lg transition-colors ${
                  s.id === sessionId ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <button
                  onClick={() => loadSession(s)}
                  className="flex-1 text-left px-[10px] py-2 text-[13.5px] font-sans border-none cursor-pointer bg-transparent whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: s.id === sessionId ? "var(--ink)" : "var(--ink-dim)" }}
                >
                  {s.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (s.id === sessionId) newChat();
                    removeSession(s.id);
                  }}
                  aria-label="Delete session"
                  className="shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-surface border-none bg-transparent cursor-pointer"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ))}
      </Sidebar>

      <main className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-[54px] shrink-0 border-b border-edge flex items-center px-6">
          <div className="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
            {isConversation ? activeTitle : "New chat"}
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
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-3 bg-accent-soft text-ink rounded-[16px_16px_4px_16px] text-[15px] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage key={i} content={msg.content} sources={msg.sources} />
                )
              )}

              {streaming && (
                <AssistantMessage
                  content={streamingText}
                  sources={streamingSources}
                  isStreaming
                  showSources={false}
                />
              )}

              {error && (
                <div
                  className="px-4 py-3 rounded-[10px] text-[13.5px] font-medium"
                  style={{ color: "#c0392e", background: "rgba(192,57,46,0.08)" }}
                >
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
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
              Answers are generated from your organisation&#39;s connected knowledge base.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function AssistantMessage({ content, sources = [], isStreaming = false, showSources = true }) {
  return (
    <div className="flex gap-[13px]">
      <div className="w-[30px] h-[30px] rounded-lg bg-accent shrink-0 flex items-center justify-center mt-[2px]">
        <div className="w-[11px] h-[11px] bg-white rounded-[3px] rotate-45" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] leading-[1.65] text-ink whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-accent rounded-[2px] align-text-bottom ml-[2px] animate-blink" />
          )}
        </div>

        {showSources && sources.length > 0 && (
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
                    {pages && <div className="mt-1 text-[11px] text-ink-faint font-mono">{pages}</div>}
                  </>
                );
                const cls = "px-[13px] py-3 bg-surface border border-edge rounded-[11px] transition-[border,box-shadow]";
                return s.url ? (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className={cls + " block hover:border-edge-strong hover:shadow-card"}>
                    {inner}
                  </a>
                ) : (
                  <div key={i} className={cls}>{inner}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
