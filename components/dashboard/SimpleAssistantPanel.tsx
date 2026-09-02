"use client";

import { useEffect, useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiCheckCircle, HiArrowPath } from "react-icons/hi2";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { openAssistantDock } from "@/lib/ui/assistantDock";
import { cn } from "@/lib/cn";

const STEPS = ["목표 설정", "AI 분석 중...", "세팅 제안 준비 중"];
const STEP_INTERVAL_MS = 2200;

export function SimpleAssistantPanel() {
  // 첫 단계(목표 설정)는 항상 완료 상태로 두고, 나머지 두 단계를 번갈아 "진행 중"으로 보여줘
  // AI가 계속 분석하고 있다는 느낌을 준다.
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev === 1 ? 2 : 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="flex flex-col gap-4 bg-[var(--color-blue-50)]">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-blue-600)]">
          <HiOutlineChatBubbleLeftRight className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-[15px] font-bold text-[var(--color-gray-900)]">AI 어시스턴트</p>
      </div>

      <div>
        <p className="text-[14px] font-semibold text-[var(--color-gray-900)]">안녕하세요! 👋</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-gray-600)]">
          광고 세팅을 더 쉽게 도와드릴게요.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {STEPS.map((label, i) => {
          const isDone = i === 0;
          const isActive = i === activeStep;
          return (
            <div key={label} className="flex items-center gap-2 text-[13px]">
              {isDone ? (
                <HiCheckCircle className="h-4 w-4 shrink-0 text-[var(--color-green-600)]" aria-hidden="true" />
              ) : isActive ? (
                <HiArrowPath className="h-4 w-4 shrink-0 animate-spin text-[var(--color-blue-500)]" aria-hidden="true" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--color-gray-300)]" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "font-medium",
                  isDone
                    ? "text-[var(--color-gray-700)]"
                    : isActive
                    ? "text-[var(--color-gray-900)]"
                    : "text-[var(--color-gray-400)]"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <Button size="md" className="w-full" onClick={() => openAssistantDock()}>
        ✨ AI 추천 받기
      </Button>
    </Card>
  );
}
