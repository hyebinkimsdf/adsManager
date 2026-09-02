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

  // 진행 중인 캠페인을 우선 순위로 메달을 매기고, 일시정지된 캠페인은 성과와 무관하게 뒤로 보낸다
  // (일시정지 상태인 캠페인이 우연히 누적 전환이 많다고 해서 "1위 트로피"를 받는 건 오해를 줄 수 있음).
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
      <div className="flex flex-col gap-4">
        {ranked.map((r) => (
          <Link key={r.campaign.id} href={`/campaigns/${r.campaign.id}`} className="block">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[var(--color-gray-900)]">
                <span aria-hidden="true">{r.medal}</span>
                <span className="truncate">{r.campaign.name}</span>
              </span>
              <span className="shrink-0 text-[var(--color-gray-500)]">{formatNumber(r.conversions)}건</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-gray-100)]">
              <div
                className="h-full rounded-full bg-[var(--color-blue-500)]"
                style={{ width: `${Math.max(4, (r.conversions / max) * 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
      <Link href="/campaigns" className="mt-4 block">
        <Button size="md" variant="secondary" className="w-full">
          전체 캠페인 보기
        </Button>
      </Link>
    </Card>
  );
}
