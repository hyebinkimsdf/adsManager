/** @jsxImportSource @emotion/react */
"use client";

import { Card } from "@/components/ui/Card";
import { formatSignedPercent } from "@/lib/format";

const TONE_COLOR: Record<"good" | "okay" | "bad" | "neutral", string> = {
  good: "var(--color-green-600)",
  okay: "var(--color-blue-600)",
  bad: "var(--color-red-500)",
  neutral: "var(--color-gray-900)",
};

export function SummaryCard({
  label,
  value,
  unit,
  trend,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: number;
  /** 광고 용어를 몰라도 이해할 수 있는 한 문장. 있으면 숫자 아래 항상 보여준다. */
  caption?: string;
  /** caption과 함께 써서, 숫자를 안 읽어도 좋은지 나쁜지 색으로 바로 알 수 있게 한다. */
  tone?: "good" | "okay" | "bad" | "neutral";
}) {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <Card>
      {/* gray-500은 이 글자 크기에서 명암비 4.5:1을 못 채운다(약 3:1) — gray-600은 채운다(약 4.6:1). */}
      <p css={{ marginBottom: "0.5rem", fontSize: 13, fontWeight: 500, color: "var(--color-gray-600)" }}>{label}</p>
      <div css={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
        <span
          css={{
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            color: TONE_COLOR[tone],
          }}
        >
          {value}
        </span>
        {unit && <span css={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-gray-600)" }}>{unit}</span>}
      </div>
      {caption && (
        <p css={{ marginTop: "0.5rem", fontSize: 12.5, lineHeight: 1.5, color: "var(--color-gray-600)" }}>{caption}</p>
      )}
      {typeof trend === "number" && (
        <p
          css={{
            marginTop: "0.5rem",
            fontSize: 13,
            fontWeight: 500,
            color: trendPositive ? "var(--color-green-600)" : "var(--color-red-500)",
          }}
        >
          {formatSignedPercent(trend)} · 지난 7일 대비
        </p>
      )}
    </Card>
  );
}
