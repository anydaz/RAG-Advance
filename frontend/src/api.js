const API_HOST = import.meta.env.VITE_API_HOST ?? "http://localhost:8000";
const BASE = `${API_HOST}/auth`;
const ADMIN = `${API_HOST}/admin`;
const CHAT = `${API_HOST}/chat`;

export async function checkOrg(orgSlug) {
  const res = await fetch(`${BASE}/check-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_slug: orgSlug }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

export async function login(orgSlug, username, password) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_slug: orgSlug, username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

export async function uploadDocument(orgSlug, file) {
  const form = new FormData();
  form.append("org_slug", orgSlug);
  form.append("file", file);
  const res = await fetch(`${ADMIN}/documents`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

export async function listDocuments(orgSlug) {
  const res = await fetch(`${ADMIN}/documents/${orgSlug}`);
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

export async function deleteDocument(orgSlug, documentId) {
  const res = await fetch(`${ADMIN}/documents/${documentId}?org_slug=${encodeURIComponent(orgSlug)}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Delete failed");
}

/**
 * Streams a chat response from the RAG agent.
 * Calls onEvent({ type: 'session'|'sources'|'token'|'done', ... }) for each SSE event.
 * Returns when the stream ends.
 */
export async function sendChat(orgSlug, username, message, sessionId, onEvent) {
  const res = await fetch(`${CHAT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_slug: orgSlug, username, message, session_id: sessionId ?? null }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Chat failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") {
        onEvent({ type: "done" });
        return;
      }
      try {
        onEvent(JSON.parse(raw));
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export async function listSessions(orgSlug, username) {
  const res = await fetch(`${CHAT}/sessions?org_slug=${encodeURIComponent(orgSlug)}&username=${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to load sessions");
  return res.json();
}

export async function getMessages(orgSlug, sessionId) {
  const res = await fetch(`${CHAT}/sessions/${sessionId}/messages?org_slug=${encodeURIComponent(orgSlug)}`);
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to load messages");
  return res.json();
}

export async function deleteSession(orgSlug, sessionId) {
  const res = await fetch(`${CHAT}/sessions/${sessionId}?org_slug=${encodeURIComponent(orgSlug)}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to delete session");
}
