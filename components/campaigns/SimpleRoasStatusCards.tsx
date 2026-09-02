import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import type { RoasBucket } from "@/lib/insights";

const TONE: Record<RoasBucket["key"], { bg: string; label: string }> = {
  good: { bg: "bg-[var(--color-green-50)]", label: "text-[var(--color-green-600)]" },
  okay: { bg: "bg-[var(--color-yellow-50)]", label: "text-[var(--color-yellow-600)]" },
  bad: { bg: "bg-[var(--color-red-50)]", label: "text-[var(--color-red-500)]" },
};

export function SimpleRoasStatusCards({ buckets }: { buckets: RoasBucket[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>전체 광고 성과는 어떤가요?</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {buckets.map((b) => (
          <div
            key={b.key}
            className={cn("flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-5 text-center", TONE[b.key].bg)}
          >
            <span className="text-[40px] leading-none" aria-hidden="true">
              {b.emoji}
            </span>
            <p className={cn("text-[17px] font-bold", TONE[b.key].label)}>{b.label}</p>
            <p className="text-[13px] leading-relaxed text-[var(--color-gray-600)]">{b.description}</p>
            <div className="mt-1 w-full rounded-[var(--radius-md)] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-[12px] text-[var(--color-gray-500)]">평균 ROAS</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[20px] font-bold text-[var(--color-gray-900)]">
                {b.count > 0 ? formatPercent(b.avgRoas, 0) : "-"}
                {b.count > 0 && b.key === "good" && (
                  <HiOutlineArrowTrendingUp className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" />
                )}
                {b.count > 0 && b.key === "bad" && (
                  <HiOutlineArrowTrendingDown className="h-4 w-4 text-[var(--color-red-500)]" aria-hidden="true" />
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
