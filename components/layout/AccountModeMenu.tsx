"use client";

import { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { cn } from "@/lib/cn";
import { useUiMode, setUiMode } from "@/lib/ui/mode";

export function AccountModeMenu() {
  const mode = useUiMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--color-gray-700)] hover:border-[var(--color-blue-500)]"
      >
        {mode === "simple" ? "간편" : "전문가"}
        <HiChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-1.5 w-32 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white py-1 shadow-[var(--shadow-float)]">
          <button
            type="button"
            onClick={() => {
              setUiMode("simple");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px]",
              mode === "simple"
                ? "font-semibold text-[var(--color-blue-600)]"
                : "text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]"
            )}
          >
            🙂 간편 모드
          </button>
          <button
            type="button"
            onClick={() => {
              setUiMode("expert");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px]",
              mode === "expert"
                ? "font-semibold text-[var(--color-blue-600)]"
                : "text-[var(--color-gray-700)] hover:bg-[var(--color-gray-50)]"
            )}
          >
            ⚙️ 전문가 모드
          </button>
        </div>
      )}
    </div>
  );
}
