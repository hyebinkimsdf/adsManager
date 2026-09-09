import type { Audience } from "@/lib/mock/types";

// D1에는 판별 유니온을 그대로 저장할 수 없어, type/estimatedSize만 컬럼으로 두고
// 나머지 필드(type별로 다른 config)는 JSON 문자열 한 컬럼에 몰아 저장한다.
export interface AudienceRow {
  id: string;
  name: string;
  type: string;
  estimatedSize: number;
  config: string;
  createdAt: string;
}

export function toAudience(row: AudienceRow): Audience {
  const config = JSON.parse(row.config) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    estimatedSize: row.estimatedSize,
    createdAt: row.createdAt,
    ...config,
  } as Audience;
}

export function toAudienceRow(audience: Audience): AudienceRow {
  const { id, name, type, estimatedSize, createdAt, ...config } = audience;
  return {
    id,
    name,
    type,
    estimatedSize,
    createdAt,
    config: JSON.stringify(config),
  };
}
