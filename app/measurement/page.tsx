/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { HiOutlineArrowRight } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useCampaigns } from "@/lib/mock/store";
import { sumHistory } from "@/lib/mock/campaigns";
import { useConversionEvents } from "@/lib/tracking/useConversionEvents";
import { formatCompactKRW, formatDateTime, formatKRW, formatPercent } from "@/lib/format";

function FunnelBar({ label, value, max, sublabel }: { label: string; value: number; max: number; sublabel?: string }) {
  const widthPct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-700)" }}>{label}</span>
        <span css={{ fontSize: 13, color: "var(--color-gray-500)" }}>
          {formatKRW(value)}
          {sublabel && <span css={{ marginLeft: "0.375rem", color: "var(--color-gray-400)" }}>{sublabel}</span>}
        </span>
      </div>
      <div
        css={css`
          height: 0.625rem;
          width: 100%;
          border-radius: 9999px;
          background-color: var(--color-gray-100);
          overflow: hidden;
        `}
      >
        <div
          css={css`
            height: 100%;
            width: ${widthPct}%;
            border-radius: 9999px;
            background-color: var(--color-blue-500);
            transition: width 300ms;
          `}
        />
      </div>
    </div>
  );
}

export default function MeasurementPage() {
  const campaigns = useCampaigns();
  const events = useConversionEvents();

  const adTotals = campaigns.reduce(
    (acc, c) => {
      const t = sumHistory(c.history);
      acc.impressions += t.impressions;
      acc.clicks += t.clicks;
      return acc;
    },
    { impressions: 0, clicks: 0 }
  );

  const visits = events.filter((e) => e.eventType === "page_view").length;
  const purchases = events.filter((e) => e.eventType === "purchase");
  const purchaseCount = purchases.length;
  const purchaseValue = purchases.reduce((sum, e) => sum + e.value, 0);
  const avgOrderValue = purchaseCount > 0 ? purchaseValue / purchaseCount : 0;

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const leads = events
    .filter((e) => e.eventType === "lead_collection")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const funnelMax = adTotals.impressions;
  const clickToVisit = adTotals.clicks > 0 ? (visits / adTotals.clicks) * 100 : 0;
  const visitToPurchase = visits > 0 ? (purchaseCount / visits) * 100 : 0;

  const perCampaign = campaigns
    .map((c) => {
      const campaignEvents = events.filter((e) => e.campaignId === c.id);
      const campaignVisits = campaignEvents.filter((e) => e.eventType === "page_view").length;
      const campaignPurchases = campaignEvents.filter((e) => e.eventType === "purchase");
      const campaignValue = campaignPurchases.reduce((sum, e) => sum + e.value, 0);
      const rate = campaignVisits > 0 ? (campaignPurchases.length / campaignVisits) * 100 : 0;
      return {
        id: c.id,
        name: c.name,
        visits: campaignVisits,
        purchases: campaignPurchases.length,
        value: campaignValue,
        rate,
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>Measurement</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          광고 이후 고객이 실제로 어떻게 행동했는지, 전환 추적으로 수집된 데이터로 확인해보세요.
        </p>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          @media (min-width: 640px) {
            grid-template-columns: repeat(5, 1fr);
          }
        `}
      >
        <Card>
          <p css={{ marginBottom: "0.5rem", fontSize: 13, color: "var(--color-gray-500)" }}>사이트 방문</p>
          <p css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatKRW(visits)}건</p>
        </Card>
        <Card>
          <p css={{ marginBottom: "0.5rem", fontSize: 13, color: "var(--color-gray-500)" }}>문의 수집</p>
          <p css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatKRW(leads.length)}건</p>
        </Card>
        <Card>
          <p css={{ marginBottom: "0.5rem", fontSize: 13, color: "var(--color-gray-500)" }}>구매</p>
          <p css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatKRW(purchaseCount)}건</p>
        </Card>
        <Card>
          <p css={{ marginBottom: "0.5rem", fontSize: 13, color: "var(--color-gray-500)" }}>구매 전환 금액</p>
          <p css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatCompactKRW(purchaseValue)}원</p>
        </Card>
        <Card>
          <p css={{ marginBottom: "0.5rem", fontSize: 13, color: "var(--color-gray-500)" }}>평균 구매 금액</p>
          <p css={{ fontSize: 22, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatCompactKRW(avgOrderValue)}원</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전환 퍼널</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <FunnelBar label="광고 노출" value={adTotals.impressions} max={funnelMax} />
          <FunnelBar label="광고 클릭" value={adTotals.clicks} max={funnelMax} />
          <FunnelBar label="사이트 방문" value={visits} max={funnelMax} sublabel={`클릭 대비 ${formatPercent(clickToVisit, 0)}`} />
          <FunnelBar
            label="구매"
            value={purchaseCount}
            max={funnelMax}
            sublabel={`방문 대비 ${formatPercent(visitToPurchase, 1)}`}
          />
        </div>
        <p css={{ marginTop: "1rem", fontSize: 12, color: "var(--color-gray-400)" }}>
          방문·구매는 각 캠페인에 연동된 전환 추적 스니펫(AdsAI.track)이 수집한 실제 이벤트예요.{" "}
          <Link href="/tracking" css={{ color: "var(--color-blue-600)", fontWeight: 500 }}>
            연동 코드 확인하기
          </Link>
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>캠페인별 전환 성과</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column" }}>
          {perCampaign.map((row, i) => (
            <div
              key={row.id}
              css={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                padding: 0.75rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <Link
                href={`/campaigns/${row.id}`}
                css={css`
                  min-width: 0;
                  flex: 1;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-size: 13.5px;
                  font-weight: 600;
                  color: var(--color-gray-900);
                  &:hover {
                    color: var(--color-blue-600);
                  }
                `}
              >
                {row.name}
              </Link>
              <Badge tone="gray">방문 {formatKRW(row.visits)}</Badge>
              <Badge tone="blue">구매 {formatKRW(row.purchases)}</Badge>
              <span css={{ flexShrink: 0, fontSize: 12.5, color: "var(--color-gray-500)" }}>
                전환율 {formatPercent(row.rate, 1)}
              </span>
              <span css={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: "var(--color-gray-800)" }}>
                {formatCompactKRW(row.value)}원
              </span>
            </div>
          ))}
          {perCampaign.length === 0 && (
            <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
              아직 캠페인이 없어요.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 문의</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column" }}>
          {leads.slice(0, 10).map((lead, i) => (
            <div
              key={lead.id}
              css={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                padding: 0.625rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <span css={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                {campaignNameById.get(lead.campaignId) ?? lead.campaignId}
              </span>
              <span css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>{formatDateTime(lead.occurredAt)}</span>
            </div>
          ))}
          {leads.length === 0 && (
            <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
              아직 수집된 문의가 없어요.
            </p>
          )}
        </div>
      </Card>

      <Link
        href="/tracking"
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: var(--radius-lg);
          background: white;
          padding: 1rem 1.25rem;
          box-shadow: var(--shadow-card);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-gray-900);

          &:hover {
            color: var(--color-blue-600);
          }
        `}
      >
        전환 추적 연동하기
        <HiOutlineArrowRight style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
      </Link>
    </div>
  );
}
