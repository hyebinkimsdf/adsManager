/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HiCheck } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { closeAssistantDock } from "@/lib/ui/assistantDock";
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
  const router = useRouter();
  const isNavigateAction = action.type === "open_keyword_tool";

  return (
    <div
      css={css`
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        background: white;
        padding: 0.875rem;
      `}
    >
      <div css={{ marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{action.label}</span>
        <Badge tone={risk.tone}>{risk.label}</Badge>
      </div>
      <p css={{ marginBottom: "0.75rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
        {action.description}
      </p>
      {action.keywords && action.keywords.length > 0 && (
        <div css={{ marginBottom: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {action.keywords.map((k) => (
            <Badge key={k} tone="blue">
              {k}
            </Badge>
          ))}
        </div>
      )}
      {status === "pending" && (
        <div css={{ display: "flex", gap: "0.5rem" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (isNavigateAction && action.campaignId) {
                closeAssistantDock();
                router.push(`/campaigns/${action.campaignId}`);
                return;
              }
              onApply(action);
              setStatus("applied");
            }}
          >
            {isNavigateAction ? "키워드 도구 열기" : "적용"}
          </Button>
          {!isNavigateAction && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("dismissed")}>
              무시
            </Button>
          )}
        </div>
      )}
      {status === "applied" && (
        <p
          css={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-green-600)",
          }}
        >
          <HiCheck style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용했어요
        </p>
      )}
      {status === "dismissed" && <p css={{ fontSize: 13, color: "var(--color-gray-400)" }}>무시했어요</p>}
    </div>
  );
}
