"use client";

import { cn } from "@/lib/cn";
import { useUiMode, setUiMode } from "@/lib/ui/mode";

export function ModeToggle({ className }: { className?: string }) {
  const mode = useUiMode();

  return (
    <div
      role="group"
      aria-label="화면 모드 선택"
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] bg-[var(--color-gray-100)] p-1",
        className
      )}
    >
      <button
        type="button"
        aria-pressed={mode === "simple"}
        onClick={() => setUiMode("simple")}
        className={cn(
          "flex-1 whitespace-nowrap rounded-[var(--radius-full)] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
          mode === "simple"
            ? "bg-white text-[var(--color-blue-600)] shadow-sm"
            : "text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
        )}
      >
        🙂 간편
      </button>
      <button
        type="button"
        aria-pressed={mode === "expert"}
        onClick={() => setUiMode("expert")}
        className={cn(
          "flex-1 whitespace-nowrap rounded-[var(--radius-full)] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
          mode === "expert"
            ? "bg-white text-[var(--color-blue-600)] shadow-sm"
            : "text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
        )}
      >
        ⚙️ 전문가
      </button>
    </div>
  );
}
