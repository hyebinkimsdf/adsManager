/** @jsxImportSource @emotion/react */
"use client";

import { Card } from "@/components/ui/Card";
import { formatSignedPercent } from "@/lib/format";

export function SummaryCard({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: number;
}) {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <Card>
      <p css={{ marginBottom: "0.5rem", fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)" }}>{label}</p>
      <div css={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
        <span
          css={{
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            color: "var(--color-gray-900)",
          }}
        >
          {value}
        </span>
        {unit && <span css={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-gray-500)" }}>{unit}</span>}
      </div>
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
