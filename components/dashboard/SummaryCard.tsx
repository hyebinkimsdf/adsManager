import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
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
      <p className="mb-2 text-[13px] font-medium text-[var(--color-gray-500)]">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-[2rem] font-bold leading-none tracking-tight text-[var(--color-gray-900)]">
          {value}
        </span>
        {unit && <span className="text-[0.875rem] font-medium text-[var(--color-gray-500)]">{unit}</span>}
      </div>
      {typeof trend === "number" && (
        <p
          className={cn(
            "mt-2 text-[13px] font-medium",
            trendPositive ? "text-[var(--color-green-600)]" : "text-[var(--color-red-500)]"
          )}
        >
          {formatSignedPercent(trend)} · 지난 7일 대비
        </p>
      )}
    </Card>
  );
}
