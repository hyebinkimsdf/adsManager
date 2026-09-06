/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiCheckCircle, HiArrowPath } from "react-icons/hi2";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { openAssistantDock } from "@/lib/ui/assistantDock";

const STEPS = ["목표 설정", "AI 분석 중...", "세팅 제안 준비 중"];
const STEP_INTERVAL_MS = 2200;

export function SimpleAssistantPanel() {
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev === 1 ? 2 : 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card
      css={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background-color: var(--color-blue-50);
      `}
    >
      <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          css={{
            display: "flex",
            height: "2rem",
            width: "2rem",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9999px",
            background: "white",
            color: "var(--color-blue-600)",
          }}
        >
          <HiOutlineChatBubbleLeftRight style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
        </span>
        <p css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>AI 어시스턴트</p>
      </div>

      <div>
        <p css={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)" }}>안녕하세요! 👋</p>
        <p css={{ marginTop: "0.125rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
          광고 세팅을 더 쉽게 도와드릴게요.
        </p>
      </div>

      <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {STEPS.map((label, i) => {
          const isDone = i === 0;
          const isActive = i === activeStep;
          return (
            <div key={label} css={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13 }}>
              {isDone ? (
                <HiCheckCircle
                  style={{ height: "1rem", width: "1rem", flexShrink: 0, color: "var(--color-green-600)" }}
                  aria-hidden="true"
                />
              ) : isActive ? (
                <HiArrowPath
                  css={css`
                    height: 1rem;
                    width: 1rem;
                    flex-shrink: 0;
                    color: var(--color-blue-500);
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
              ) : (
                <span
                  css={{
                    height: "1rem",
                    width: "1rem",
                    flexShrink: 0,
                    borderRadius: "9999px",
                    border: "2px solid var(--color-gray-300)",
                  }}
                  aria-hidden="true"
                />
              )}
              <span
                css={{
                  fontWeight: 500,
                  color: isDone
                    ? "var(--color-gray-700)"
                    : isActive
                    ? "var(--color-gray-900)"
                    : "var(--color-gray-400)",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <Button size="md" css={{ width: "100%" }} onClick={() => openAssistantDock()}>
        ✨ AI 추천 받기
      </Button>
    </Card>
  );
}
