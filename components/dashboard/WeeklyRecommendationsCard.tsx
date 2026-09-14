/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import {
  HiArrowTrendingDown,
  HiArrowTrendingUp,
  HiOutlineUserGroup,
  HiOutlineClock,
  HiSparkles,
  HiCheck,
  HiChevronRight,
  HiArrowPath,
  HiExclamationTriangle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { adjustBudgetByPercent } from "@/lib/mock/store";
import { openAssistantDock } from "@/lib/ui/assistantDock";
import type { WeeklyRecommendation } from "@/lib/insights";

const TONE: Record<WeeklyRecommendation["tone"], { bg: string; color: string; icon: IconType }> = {
  warning: { bg: "var(--color-red-50)", color: "var(--color-red-500)", icon: HiArrowTrendingDown },
  positive: { bg: "var(--color-green-50)", color: "var(--color-green-600)", icon: HiArrowTrendingUp },
  info: { bg: "var(--color-violet-50)", color: "var(--color-violet-600)", icon: HiOutlineUserGroup },
  neutral: { bg: "var(--color-gray-100)", color: "var(--color-gray-500)", icon: HiOutlineClock },
};

// focus_target/observing은 자동 적용할 변경이 없다 — 확인/이동만 한다.
const NON_APPLICABLE_KINDS: WeeklyRecommendation["kind"][] = ["focus_target", "observing"];

type ApplyState = "idle" | "pending" | "done" | "error";

async function applyRecommendation(item: WeeklyRecommendation) {
  if (item.kind === "lower_budget" || item.kind === "raise_budget") {
    await adjustBudgetByPercent(item.campaignId, item.percent, item.kind);
  }
}

export function WeeklyRecommendationsCard({ items }: { items: WeeklyRecommendation[] }) {
  const [state, setState] = useState<Record<string, ApplyState>>({});
  const [errorMessage, setErrorMessage] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  async function handleApply(item: WeeklyRecommendation) {
    setState((prev) => ({ ...prev, [item.id]: "pending" }));
    try {
      await applyRecommendation(item);
      setState((prev) => ({ ...prev, [item.id]: "done" }));
    } catch (err) {
      setErrorMessage((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "저장에 실패했어요.",
      }));
      setState((prev) => ({ ...prev, [item.id]: "error" }));
    }
  }

  return (
    <Card>
      <div css={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div css={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
          <span
            css={{
              display: "flex",
              height: "2rem",
              width: "2rem",
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              backgroundColor: "var(--color-blue-50)",
            }}
          >
            <HiSparkles style={{ height: "1rem", width: "1rem", color: "var(--color-blue-500)" }} aria-hidden="true" />
          </span>
          <div>
            <div css={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <p css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>
                확인해 볼 광고 설정 <span css={{ color: "var(--color-gray-400)", fontWeight: 500 }}>{items.length}개</span>
              </p>
            </div>
            <p css={{ marginTop: "0.125rem", fontSize: 13, color: "var(--color-gray-500)" }}>
              숫자를 비교해 골랐어요. 바꿀 내용은 직접 확인해 주세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAssistantDock()}
          css={css`
            display: flex;
            flex-shrink: 0;
            align-items: center;
            gap: 0.125rem;
            padding-top: 0.375rem;
            font-size: 13px;
            font-weight: 500;
            color: var(--color-gray-500);
            white-space: nowrap;

            &:hover {
              color: var(--color-gray-700);
            }
          `}
        >
          전체 보기
          <HiChevronRight style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
        </button>
      </div>

      <div
        css={css`
          margin-top: 1rem;
          display: flex;
          flex-direction: column;

          & > div + div {
            border-top: 1px solid var(--border-subtle);
          }
        `}
      >
        {items.map((item, i) => {
          const tone = TONE[item.tone];
          const Icon = tone.icon;
          const itemState: ApplyState = state[item.id] ?? "idle";

          return (
            <div
              key={item.id}
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                padding: 0.875rem 0;
                ${i === 0 && "padding-top: 0;"}
                ${i === items.length - 1 && "padding-bottom: 0;"}
                @media (min-width: 640px) {
                  flex-direction: row;
                  align-items: center;
                }
              `}
            >
              <span
                css={{
                  display: "flex",
                  height: "2.5rem",
                  width: "2.5rem",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  backgroundColor: tone.bg,
                }}
              >
                <Icon style={{ height: "1.25rem", width: "1.25rem", color: tone.color }} aria-hidden="true" />
              </span>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{item.title}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-500)" }}>
                  {item.detail}
                </p>
                {itemState === "error" && (
                  <p
                    css={{
                      marginTop: "0.375rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: 12.5,
                      color: "var(--color-red-500)",
                    }}
                  >
                    <HiExclamationTriangle style={{ height: "0.875rem", width: "0.875rem", flexShrink: 0 }} aria-hidden="true" />
                    {errorMessage[item.id] ?? "저장에 실패했어요."}
                  </p>
                )}
              </div>

              <div
                css={css`
                  display: flex;
                  flex-shrink: 0;
                  align-items: center;
                  justify-content: space-between;
                  gap: 1rem;
                  width: 100%;
                  @media (min-width: 640px) {
                    width: auto;
                    justify-content: flex-end;
                  }
                `}
              >
                <div css={{ textAlign: "right", flexShrink: 0 }}>
                  <p css={{ fontSize: 11.5, color: "var(--color-gray-400)" }}>{item.impactLabel}</p>
                  <p css={{ marginTop: "0.0625rem", fontSize: 13, fontWeight: 700, color: "var(--color-gray-800)" }}>
                    {item.impactValue}
                  </p>
                </div>

                {NON_APPLICABLE_KINDS.includes(item.kind) ? (
                  <Link href={`/campaigns/${item.campaignId}`} css={{ flexShrink: 0 }}>
                    <Button size="md" variant="secondary">
                      {item.buttonLabel}
                    </Button>
                  </Link>
                ) : itemState === "done" ? (
                  <span css={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--color-green-600)" }}>
                    <span css={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <HiCheck style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 적용 완료
                    </span>
                  </span>
                ) : (
                  <Button
                    size="md"
                    variant={itemState === "error" ? "secondary" : "primary"}
                    disabled={itemState === "pending"}
                    css={{ flexShrink: 0 }}
                    onClick={() => handleApply(item)}
                  >
                    {itemState === "pending" ? (
                      <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <HiArrowPath
                          css={css`
                            height: 1rem;
                            width: 1rem;
                            animation: spin 1s linear infinite;
                            @keyframes spin {
                              from {
                                transform: rotate(0deg);
                              }
                              to {
                                transform: rotate(360deg);
                              }
                            }
                          `}
                          aria-hidden="true"
                        />
                        적용 중...
                      </span>
                    ) : itemState === "error" ? (
                      "다시 시도"
                    ) : (
                      item.buttonLabel
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
