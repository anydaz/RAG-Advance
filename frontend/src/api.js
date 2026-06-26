const API_HOST = import.meta.env.VITE_API_HOST ?? "http://localhost:8000";
const BASE = `${API_HOST}/auth`;
const ADMIN = `${API_HOST}/admin`;

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
