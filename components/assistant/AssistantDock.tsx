/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { HiSparkles } from "react-icons/hi2";
import { SlideOver } from "@/components/ui/SlideOver";
import { Button } from "@/components/ui/Button";
import { ChatBubble, TypingBubble } from "./ChatBubble";
import { ActionProposalCard } from "./ActionProposalCard";
import { AvailabilityBanner } from "./AvailabilityBanner";
import { useLanguageModel } from "@/lib/ai/useLanguageModel";
import { applyAction } from "@/lib/ai/applyAction";
import { buildSnapshots } from "@/lib/ai/context";
import { useCampaigns } from "@/lib/mock/store";
import { useAssistantDockOpen, openAssistantDock, closeAssistantDock } from "@/lib/ui/assistantDock";
import type { ChatTurn } from "@/lib/ai/types";

const SUGGESTIONS = ["이번 주 성과 어때?", "예산 늘려줘", "성과 낮은 캠페인 알려줘", "키워드 추천해줘"];

let turnCounter = 0;
function nextTurnId() {
  turnCounter += 1;
  return `turn-${turnCounter}`;
}

export function AssistantDock() {
  const open = useAssistantDockOpen();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: "welcome",
      role: "assistant",
      reply: {
        reply: "안녕하세요! 캠페인 성과 확인부터 예산 조정까지 대화로 도와드릴게요.",
        actions: [],
      },
    },
  ]);
  const { state, downloadProgress, ask } = useLanguageModel();
  const campaigns = useCampaigns();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    const userTurn: ChatTurn = { id: nextTurnId(), role: "user", text: trimmed };
    const pendingTurn: ChatTurn = { id: nextTurnId(), role: "assistant", pending: true };
    setTurns((prev) => [...prev, userTurn, pendingTurn]);
    setInput("");

    const snapshots = buildSnapshots(campaigns);
    const { reply, engine: engineUsed } = await ask(trimmed, snapshots);

    setTurns((prev) =>
      prev.map((t) => (t.id === pendingTurn.id ? { ...t, pending: false, reply, engineUsed } : t))
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openAssistantDock()}
        aria-label="AI 어시스턴트 열기"
        css={css`
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 40;
          display: flex;
          height: 3.5rem;
          width: 3.5rem;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background-color: var(--color-blue-500);
          color: white;
          box-shadow: var(--shadow-float);
          transition: transform 150ms;

          &:hover {
            transform: scale(1.05);
          }
          &:active {
            transform: scale(0.95);
          }
          &:focus-visible {
            outline: none;
            box-shadow: 0 0 0 2px white, 0 0 0 4px var(--color-blue-700);
          }
        `}
      >
        <HiSparkles style={{ height: "1.5rem", width: "1.5rem" }} aria-hidden="true" />
      </button>

      <SlideOver
        open={open}
        onClose={() => closeAssistantDock()}
        title="AI 어시스턴트"
        footer={
          <form onSubmit={handleSubmit} css={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="예: 예산 늘려줘"
              rows={1}
              css={css`
                max-height: 6rem;
                flex: 1;
                resize: none;
                border-radius: var(--radius-sm);
                border: 1px solid var(--border-subtle);
                background: var(--color-gray-50);
                padding: 0.625rem 0.875rem;
                font-size: 14px;
                color: var(--color-gray-900);
                outline: none;

                &:focus {
                  border-color: var(--color-blue-500);
                }
              `}
            />
            <Button type="submit" size="md" disabled={!input.trim()}>
              전송
            </Button>
          </form>
        }
      >
        <AvailabilityBanner state={state} downloadProgress={downloadProgress} />
        <div ref={scrollRef} css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {turns.map((turn) =>
            turn.role === "user" ? (
              <ChatBubble key={turn.id} role="user">
                {turn.text}
              </ChatBubble>
            ) : turn.pending ? (
              <TypingBubble key={turn.id} />
            ) : (
              <div key={turn.id} css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <ChatBubble role="assistant">{turn.reply?.reply}</ChatBubble>
                {turn.engineUsed === "preview" && (
                  <span css={{ marginTop: "-0.25rem", fontSize: 11, color: "var(--color-gray-400)" }}>
                    미리보기 응답이에요
                  </span>
                )}
                {turn.engineUsed === "cloud" && (
                  <span css={{ marginTop: "-0.25rem", fontSize: 11, color: "var(--color-gray-400)" }}>
                    클라우드 AI로 답변했어요
                  </span>
                )}
                {turn.reply?.actions.map((action) => (
                  <ActionProposalCard key={action.id} action={action} onApply={applyAction} />
                ))}
              </div>
            )
          )}
        </div>
        {turns.length <= 1 && (
          <div css={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                css={css`
                  border-radius: 9999px;
                  border: 1px solid var(--border-subtle);
                  padding: 0.375rem 0.75rem;
                  font-size: 12px;
                  color: var(--color-gray-600);

                  &:hover {
                    border-color: var(--color-blue-500);
                    color: var(--color-blue-600);
                  }
                `}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </SlideOver>
    </>
  );
}
