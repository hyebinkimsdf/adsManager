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

// 주어진 시각만으로 결정되는 절대 시각(KST) 포맷. Date.now()나 런타임 로컬 타임존에 기대지 않아
// 서버/클라이언트 렌더가 항상 같은 문자열을 낸다(둘 다 UTC 기준 산술만 사용).
export function formatDateTime(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

export function formatDateRange(start: Date, end: Date): string {
  const y = start.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();
  const startPart = `${y}. ${start.getMonth() + 1}. ${start.getDate()}.`;
  const endPart = sameMonth ? `${end.getDate()}.` : `${end.getMonth() + 1}. ${end.getDate()}.`;
  return `${startPart} ~ ${endPart}`;
}
