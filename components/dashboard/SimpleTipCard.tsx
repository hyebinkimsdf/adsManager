"use client";

import { useState } from "react";
import { HiOutlineLightBulb, HiChevronRight } from "react-icons/hi2";
import { Card } from "@/components/ui/Card";

const TIPS = [
  {
    title: "이미지 소재를 다양하게 테스트해보세요!",
    detail: "다양한 이미지가 전환율을 높이는 데 도움이 돼요.",
  },
  {
    title: "주말에는 예산을 조금 늘려보세요!",
    detail: "업종에 따라 주말 전환이 더 잘 나오기도 해요.",
  },
  {
    title: "너무 많은 키워드보다 핵심 키워드가 좋아요!",
    detail: "적은 수의 정확한 키워드가 광고 효율을 높여줘요.",
  },
  {
    title: "일주일에 한 번은 캠페인을 점검해보세요!",
    detail: "작은 조정만으로도 성과가 달라질 수 있어요.",
  },
];

export function SimpleTipCard() {
  const [tip, setTip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  function nextTip() {
    setTip((current) => {
      const rest = TIPS.filter((t) => t !== current);
      return rest[Math.floor(Math.random() * rest.length)];
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-1.5">
        <HiOutlineLightBulb className="h-4 w-4 text-[var(--color-blue-500)]" aria-hidden="true" />
        <p className="text-[13px] font-semibold text-[var(--color-gray-900)]">오늘의 AI 팁</p>
      </div>
      <button type="button" onClick={nextTip} className="flex w-full items-center gap-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-relaxed text-[var(--color-gray-900)]">{tip.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-gray-500)]">{tip.detail}</p>
        </div>
        <HiChevronRight className="h-4 w-4 shrink-0 text-[var(--color-gray-300)]" aria-hidden="true" />
      </button>
    </Card>
  );
}
