import type { Creative } from "@/lib/mock/types";

const API_BASE = "/api/creatives";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json();
}

export async function getCreatives(): Promise<Creative[]> {
  return fetchJson<Creative[]>(API_BASE);
}

export async function createCreative(creative: Creative): Promise<Creative> {
  return fetchJson<Creative>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creative),
  });
}

export async function deleteCreative(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}
