/** @jsxImportSource @emotion/react */
"use client";

import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";

export function SimpleStat({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  unit,
  trendPercent,
  trendSuffix,
  trendTone = "neutral",
}: {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  trendPercent?: number;
  trendSuffix?: string;
  trendTone?: "positive" | "negative" | "neutral";
}) {
  const showTrend = typeof trendPercent === "number" && trendSuffix;
  const trendColor =
    trendTone === "positive"
      ? "var(--color-green-600)"
      : trendTone === "negative"
      ? "var(--color-red-500)"
      : "var(--color-gray-700)";

  return (
    <Card css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <span
        css={{
          display: "flex",
          height: "2.75rem",
          width: "2.75rem",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          backgroundColor: iconBg,
        }}
      >
        <Icon style={{ height: "1.25rem", width: "1.25rem", color: iconColor }} aria-hidden="true" />
      </span>
      <div>
        <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>{label}</p>
        <p css={{ marginTop: "0.25rem", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
          <span css={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, color: "var(--color-gray-900)" }}>
            {value}
          </span>
          {unit && <span css={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)" }}>{unit}</span>}
        </p>
      </div>
      {showTrend && (
        <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>
          지난달보다{" "}
          <span css={{ fontWeight: 600, color: trendColor }}>{Math.abs(trendPercent!).toFixed(0)}%</span>{" "}
          {trendSuffix}
        </p>
      )}
    </Card>
  );
}
