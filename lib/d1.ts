const API_BASE = "https://api.cloudflare.com/client/v4";

interface D1QueryResult<T> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number };
}

interface D1ApiResponse<T> {
  result: D1QueryResult<T>[];
  success: boolean;
  errors: { code: number; message: string }[];
}

export function isD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_D1_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
  );
}

// Cloudflare D1은 Workers 바인딩(env.DB) 없이, 이 REST API로도 외부(Node.js 등)에서 쿼리를 보낼 수 있다.
// https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("Cloudflare D1이 설정되지 않았습니다 (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_D1_DATABASE_ID/CLOUDFLARE_API_TOKEN).");
  }

  const res = await fetch(`${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const data = (await res.json()) as D1ApiResponse<T>;
  if (!res.ok || !data.success) {
    const message = data.errors?.map((e) => e.message).join(", ") || `D1 요청 실패 (${res.status})`;
    throw new Error(message);
  }
  return data.result[0]?.results ?? [];
}
