import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

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

  return (
    <Card className="flex flex-col gap-3">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-[14px]", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
      </span>
      <div>
        <p className="text-[13px] text-[var(--color-gray-500)]">{label}</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-[1.75rem] font-bold leading-none text-[var(--color-gray-900)]">{value}</span>
          {unit && <span className="text-[13px] font-medium text-[var(--color-gray-500)]">{unit}</span>}
        </p>
      </div>
      {showTrend && (
        <p className="text-[13px] text-[var(--color-gray-500)]">
          지난달보다{" "}
          <span
            className={cn(
              "font-semibold",
              trendTone === "positive" && "text-[var(--color-green-600)]",
              trendTone === "negative" && "text-[var(--color-red-500)]",
              trendTone === "neutral" && "text-[var(--color-gray-700)]"
            )}
          >
            {Math.abs(trendPercent!).toFixed(0)}%
          </span>{" "}
          {trendSuffix}
        </p>
      )}
    </Card>
  );
}
