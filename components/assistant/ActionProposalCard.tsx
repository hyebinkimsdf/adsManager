"use client";

import { useState } from "react";
import { HiCheck } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { AssistantAction } from "@/lib/ai/types";

const riskLabel: Record<AssistantAction["riskLevel"], { label: string; tone: "gray" | "blue" | "red" }> = {
  low: { label: "가벼운 변경", tone: "gray" },
  medium: { label: "확인 필요", tone: "blue" },
  high: { label: "신중한 결정", tone: "red" },
};

export function ActionProposalCard({
  action,
  onApply,
}: {
  action: AssistantAction;
  onApply: (action: AssistantAction) => void;
}) {
  const [status, setStatus] = useState<"pending" | "applied" | "dismissed">("pending");
  const risk = riskLabel[action.riskLevel];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-gray-900)]">{action.label}</span>
        <Badge tone={risk.tone}>{risk.label}</Badge>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-gray-600)]">{action.description}</p>
      {action.keywords && action.keywords.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {action.keywords.map((k) => (
            <Badge key={k} tone="blue">
              {k}
            </Badge>
          ))}
        </div>
      )}
      {status === "pending" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onApply(action);
              setStatus("applied");
            }}
          >
            적용
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus("dismissed")}>
            무시
          </Button>
        </div>
      )}
      {status === "applied" && (
        <p className={cn("flex items-center gap-1 text-[13px] font-medium text-[var(--color-green-600)]")}>
          <HiCheck className="h-4 w-4" aria-hidden="true" /> 적용했어요
        </p>
      )}
      {status === "dismissed" && (
        <p className="text-[13px] text-[var(--color-gray-400)]">무시했어요</p>
      )}
    </div>
  );
}
