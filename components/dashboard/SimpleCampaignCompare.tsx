/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { sumHistory } from "@/lib/mock/campaigns";
import { formatNumber } from "@/lib/format";
import type { Campaign } from "@/lib/mock/types";

const MEDALS = ["🏆", "🥈", "🥉"];
const MAX_ROWS = 4;

export function SimpleCampaignCompare({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return null;

  const active = campaigns
    .filter((c) => c.status === "active")
    .map((c) => ({ campaign: c, conversions: sumHistory(c.history).conversions }))
    .sort((a, b) => b.conversions - a.conversions)
    .map((r, i) => ({ ...r, medal: MEDALS[i] ?? "▪️" }));

  const paused = campaigns
    .filter((c) => c.status !== "active")
    .map((c) => ({ campaign: c, conversions: sumHistory(c.history).conversions, medal: "▪️" }))
    .sort((a, b) => b.conversions - a.conversions);

  const ranked = [...active, ...paused].slice(0, MAX_ROWS);
  const max = Math.max(...ranked.map((r) => r.conversions), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>캠페인 성과 한눈에 보기</CardTitle>
      </CardHeader>
      <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {ranked.map((r) => (
          <Link key={r.campaign.id} href={`/campaigns/${r.campaign.id}`} css={{ display: "block" }}>
            <div
              css={{
                marginBottom: "0.375rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                fontSize: 13,
              }}
            >
              <span
                css={{
                  display: "flex",
                  minWidth: 0,
                  alignItems: "center",
                  gap: "0.375rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  color: "var(--color-gray-900)",
                }}
              >
                <span aria-hidden="true">{r.medal}</span>
                <span css={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.campaign.name}
                </span>
              </span>
              <span css={{ flexShrink: 0, color: "var(--color-gray-500)" }}>{formatNumber(r.conversions)}건</span>
            </div>
            <div
              css={css`
                height: 0.75rem;
                width: 100%;
                overflow: hidden;
                border-radius: 9999px;
                background-color: var(--color-gray-100);
              `}
            >
              <div
                css={css`
                  height: 100%;
                  border-radius: 9999px;
                  background-color: var(--color-blue-500);
                `}
                style={{ width: `${Math.max(4, (r.conversions / max) * 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
      <Link href="/campaigns" css={{ marginTop: "1rem", display: "block" }}>
        <Button size="md" variant="secondary" css={{ width: "100%" }}>
          전체 캠페인 보기
        </Button>
      </Link>
    </Card>
  );
}
