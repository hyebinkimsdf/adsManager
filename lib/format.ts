export function formatKRW(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function formatCompactKRW(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
  return formatKRW(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatDateRange(start: Date, end: Date): string {
  const y = start.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();
  const startPart = `${y}. ${start.getMonth() + 1}. ${start.getDate()}.`;
  const endPart = sameMonth ? `${end.getDate()}.` : `${end.getMonth() + 1}. ${end.getDate()}.`;
  return `${startPart} ~ ${endPart}`;
}
