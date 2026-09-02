"use client";

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
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-blue-500)] text-white shadow-[var(--shadow-float)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-blue-700)] focus-visible:ring-offset-2"
      >
        <HiSparkles className="h-6 w-6" aria-hidden="true" />
      </button>

      <SlideOver
        open={open}
        onClose={() => closeAssistantDock()}
        title="AI 어시스턴트"
        footer={
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
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
              className="max-h-24 flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--color-gray-50)] px-3.5 py-2.5 text-[14px] text-[var(--color-gray-900)] outline-none focus:border-[var(--color-blue-500)]"
            />
            <Button type="submit" size="md" disabled={!input.trim()}>
              전송
            </Button>
          </form>
        }
      >
        <AvailabilityBanner state={state} downloadProgress={downloadProgress} />
        <div ref={scrollRef} className="flex flex-col gap-3">
          {turns.map((turn) =>
            turn.role === "user" ? (
              <ChatBubble key={turn.id} role="user">
                {turn.text}
              </ChatBubble>
            ) : turn.pending ? (
              <TypingBubble key={turn.id} />
            ) : (
              <div key={turn.id} className="flex flex-col gap-2">
                <ChatBubble role="assistant">{turn.reply?.reply}</ChatBubble>
                {turn.engineUsed === "preview" && (
                  <span className="-mt-1 text-[11px] text-[var(--color-gray-400)]">미리보기 응답이에요</span>
                )}
                {turn.reply?.actions.map((action) => (
                  <ActionProposalCard key={action.id} action={action} onApply={applyAction} />
                ))}
              </div>
            )
          )}
        </div>
        {turns.length <= 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-[var(--radius-full)] border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--color-gray-600)] hover:border-[var(--color-blue-500)] hover:text-[var(--color-blue-600)]"
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
