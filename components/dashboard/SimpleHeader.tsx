function Mascot() {
  return (
    <div className="relative h-14 w-14 shrink-0 rounded-full bg-white shadow-[var(--shadow-card)]">
      <span className="absolute left-[24%] top-[38%] h-1.5 w-1.5 rounded-full bg-[var(--color-gray-900)]" />
      <span className="absolute right-[24%] top-[38%] h-1.5 w-1.5 rounded-full bg-[var(--color-gray-900)]" />
      <span className="absolute bottom-[22%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--color-blue-500)]" />
    </div>
  );
}

export function SimpleHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[20px] font-bold leading-snug text-[var(--color-gray-900)] sm:text-[24px]">
          AI가 알아서 <span className="text-[var(--color-blue-600)]">광고 세팅</span>을 도와드려요
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-gray-500)]">
          목표만 알려주시면 AI가 최적의 광고 설정을 제안해 드려요.
        </p>
      </div>
      <div className="hidden items-end gap-3 sm:flex">
        <div className="rounded-[var(--radius-md)] bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-[var(--color-gray-800)] shadow-[var(--shadow-card)]">
          오늘은 어떤 목표로
          <br />
          광고를 진행할까요? 😊
        </div>
        <Mascot />
      </div>
    </div>
  );
}
