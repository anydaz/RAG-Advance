const BASE = "/auth";

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
