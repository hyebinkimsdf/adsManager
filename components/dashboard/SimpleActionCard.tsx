"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { applyAction } from "@/lib/ai/applyAction";
import type { SimpleAction } from "@/lib/insights";

export function SimpleActionCard({ item }: { item: SimpleAction }) {
  const [applied, setApplied] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-white p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
      <span className="text-[28px] leading-none" aria-hidden="true">
        {item.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-[var(--color-gray-900)]">{item.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-gray-500)]">{item.detail}</p>
      </div>
      {applied ? (
        <span className="shrink-0 text-[13px] font-semibold text-[var(--color-green-600)]">완료했어요 ✅</span>
      ) : (
        <Button
          size="md"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => {
            applyAction(item.action);
            setApplied(true);
          }}
        >
          🤖 AI에게 맡기기
        </Button>
      )}
    </div>
  );
}
