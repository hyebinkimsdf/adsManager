export function SimpleSummaryHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[20px] font-bold leading-snug text-[var(--color-gray-900)] sm:text-[24px]">
          AI가 광고를 <span className="text-[var(--color-blue-600)]">잘 관리</span>하고 있어요!
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-gray-500)]">
          현재 상태를 한눈에 확인하고, 더 좋은 결과를 만들어보세요.
        </p>
      </div>
      <div className="hidden items-end gap-3 sm:flex">
        <div className="rounded-[var(--radius-md)] bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-[var(--color-gray-800)] shadow-[var(--shadow-card)]">
          걱정 마세요!
          <br />
          AI가 최적의 상태로
          <br />
          관리하고 있어요 😊
        </div>
        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[32px] shadow-[var(--shadow-card)]"
          aria-hidden="true"
        >
          🤖
          <span className="animate-pulse-dot absolute -right-1 -top-1 text-[14px]">✨</span>
        </div>
      </div>
    </div>
  );
}
