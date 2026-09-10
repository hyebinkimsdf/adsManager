import type { Campaign, DayMetric } from "@/lib/mock/types";

export type MetricKey = "spend" | "impressions" | "clicks" | "conversions" | "revenue";

export function kstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function metricDates(days: number, now = new Date()): string[] {
  const end = Date.parse(`${kstDate(now)}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => new Date(end - (days - 1 - index) * 86400000).toISOString().slice(0, 10));
}

export function hasVerifiedMetrics(campaign: Campaign): boolean {
  return campaign.metricSource === "live" && campaign.history.length > 0 && campaign.history.every((day) =>
    typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    Number.isFinite(Date.parse(`${day.date}T00:00:00Z`)) &&
    new Date(`${day.date}T00:00:00Z`).toISOString().slice(0, 10) === day.date &&
    [day.spend, day.impressions, day.clicks, day.conversions, day.revenue].every((value) => Number.isFinite(value) && value >= 0)
  );
}

export function metricHistory(campaign: Campaign, days = 14, now = new Date()): DayMetric[] {
  if (!hasVerifiedMetrics(campaign)) return [];
  const dates = new Set(metricDates(days, now));
  return campaign.history.filter((day) => dates.has(day.date!)).sort((a, b) => a.date!.localeCompare(b.date!));
}

export function metricSeries(campaigns: Campaign[], days: number, key: MetricKey, now = new Date()): number[] {
  const dates = metricDates(days, now);
  const sums = new Map(dates.map((date) => [date, 0]));
  for (const campaign of campaigns) {
    for (const day of metricHistory(campaign, days, now)) sums.set(day.date!, (sums.get(day.date!) ?? 0) + day[key]);
  }
  return dates.map((date) => sums.get(date) ?? 0);
}
