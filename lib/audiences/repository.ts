import type { Audience } from "@/lib/mock/types";

const API_BASE = "/api/audiences";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

export async function getAudiences(): Promise<Audience[]> {
  return fetchJson<Audience[]>(API_BASE);
}

export async function createAudience(audience: Audience): Promise<Audience> {
  return fetchJson<Audience>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(audience),
  });
}

export async function deleteAudience(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}
