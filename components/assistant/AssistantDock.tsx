/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { useAtom } from "jotai";
import { HiSparkles } from "react-icons/hi2";
import { SlideOver } from "@/components/ui/SlideOver";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EngineBadge } from "@/components/dashboard/EngineBadge";
import { ChatBubble, TypingBubble } from "./ChatBubble";
import { ActionProposalCard } from "./ActionProposalCard";
import { AvailabilityBanner } from "./AvailabilityBanner";
import { useLanguageModel } from "@/lib/ai/useLanguageModel";
import { applyAction } from "@/lib/ai/applyAction";
import { buildSnapshots } from "@/lib/ai/context";
import { handleBudgetRequest } from "@/lib/ai/budgetRequest";
import { isSetupRequest, isSetupEdit } from "@/lib/campaigns/setupConversation";
import { useCampaignSetup } from "@/lib/campaigns/useCampaignSetup";
import { CampaignSetupCard } from "@/components/campaigns/CampaignSetupCard";
import { handlePerformanceQuery } from "@/lib/ai/performanceQuery";
import { handleImprovementRequest } from "@/lib/ai/performanceImprovement";
import { isPlainGreeting, greetingReply } from "@/lib/ai/greeting";
import { useCampaign, useCampaigns, useCampaignsSummary } from "@/lib/mock/store";
import {
  useAssistantDockOpen,
  useAssistantDockFocusedCampaignId,
  openAssistantDock,
  closeAssistantDock,
} from "@/lib/ui/assistantDock";
import { chatTurnsAtom } from "@/lib/ai/chatHistory";
import type { ChatTurn } from "@/lib/ai/types";

const SUGGESTIONS = ["새 광고 만들기", "이번 주 성과 어때?", "예산 늘려줘", "성과 낮은 캠페인 알려줘"];

function nextTurnId() {
  return `turn-${crypto.randomUUID()}`;
}

const pillStyle = css`
  border-radius: 9999px;
  border: 1px solid var(--border-subtle);
  padding: 0.375rem 0.75rem;
  font-size: 12px;
  color: var(--color-gray-600);

  &:hover {
    border-color: var(--color-blue-500);
    color: var(--color-blue-600);
  }
`;

/** 긴 문장을 다시 타이핑하지 않도록, 눌러서 바로 보낼 수 있는 짧은 선택지 한 줄. */
function QuickReplies({ items, onSelect }: { items: string[]; onSelect: (text: string) => void }) {
  return (
    <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onSelect(item)} css={pillStyle}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function AssistantDock() {
  const open = useAssistantDockOpen();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showSetup, setShowSetup] = useState(false);
  const setup = useCampaignSetup(false);
  // 새로고침·재방문에도 대화가 이어지도록 로컬 스토리지와 동기화된 atom을 쓴다.
  const [turns, setTurns] = useAtom(chatTurnsAtom);
  const { ask } = useLanguageModel();
  // 홈 화면과 캐시 키(["campaigns","summary"])를 공유하므로, 홈에서 이미 로드했다면
  // 신선도 유지 기간에는 추가 요청 없이 같은 요약(topCampaigns ≤ 20건)을 재사용한다 — 캠페인이 수천 건이어도
  // AI 프롬프트가 전체를 통째로 직렬화하지 않도록 크기를 고정한다.
  const campaigns = useCampaignsSummary().topCampaigns;
  // 성과 비교 질문("전환율 제일 낮은 캠페인은?")은 지출 상위 캠페인만으로는 정답을 보장할 수 없어
  // 캡 없는 전체 목록을 따로 가져온다 — nano에 보내는 컨텍스트(campaigns)와는 별개 용도다.
  const allCampaigns = useCampaigns();
  const focusedCampaignId = useAssistantDockFocusedCampaignId();
  const focusedCampaign = useCampaign(focusedCampaignId ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(message: string) {
    if (busyRef.current || setup.saving || !message.trim()) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await processMessage(message);
    } catch {
      setTurns(prev => prev.map(t => t.pending ? { ...t, pending: false, reply: { reply: "답변을 만들지 못했어요. 다시 말씀해 주세요.", actions: [] } } : t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function processMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    const userTurn: ChatTurn = { id: nextTurnId(), role: "user", text: trimmed };
    const pendingTurn: ChatTurn = { id: nextTurnId(), role: "assistant", pending: true };
    setTurns((prev) => [...prev, userTurn, pendingTurn]);
    setInput("");

    const snapshots = buildSnapshots(campaigns);

    // 생성 중 예산 수정은 기존 캠페인 예산 변경보다 먼저 처리한다.
    if (showSetup && /^(취소|그만|닫기|나중에)/.test(trimmed)) {
      setShowSetup(false);
      setTurns(prev => prev.map(t => t.id === pendingTurn.id ? { ...t, pending: false, reply: { reply: "설정 카드를 닫았어요. 저장하지 않은 내용은 광고에 적용되지 않아요.", actions: [] } } : t));
      return;
    }
    const newSetup = isSetupRequest(trimmed);
    if (newSetup || (showSetup && !setup.created && isSetupEdit(trimmed))) {
      const note = setup.startFromMessage(trimmed, newSetup && (!showSetup || !!setup.created || /하나 더|새로|다른/.test(trimmed)));
      setShowSetup(true);
      setTurns(prev => prev.map(t => t.id === pendingTurn.id ? { ...t, pending: false, reply: { reply: newSetup ? "설정을 준비했어요. 아래에서 확인해 주세요." : note, actions: [] } } : t));
      return;
    }

    // 예산 변경 요청은 대상·금액 해석을 온디바이스/클라우드/미리보기 엔진에 맡기지 않고
    // 여기서 결정론적으로 먼저 처리한다 — 어떤 엔진이 떠 있어도 항상 같은 정확도를 보장하기 위함.
    const budgetOutcome = handleBudgetRequest(trimmed, snapshots, focusedCampaignId);
    if (budgetOutcome.kind !== "not_budget_request") {
      console.info("[assistant] 도구 분류 → 예산 변경(규칙 기반, 나노 미호출)", {
        message: trimmed,
        outcome: budgetOutcome.kind,
      });
      setTurns((prev) =>
        prev.map((t) => (t.id === pendingTurn.id ? { ...t, pending: false, reply: budgetOutcome.reply } : t))
      );
      return;
    }

    // "낮은 캠페인 개선해줘"처럼 지표 조회에 조치 요청이 같이 붙은 문장은, 순위만 답하는
    // performanceQuery보다 먼저 확인해서 원인 진단 + 실행 가능한 조정안까지 만든다.
    const improvementOutcome = handleImprovementRequest(trimmed, allCampaigns);
    if (improvementOutcome.kind !== "not_applicable") {
      console.info("[assistant] 도구 분류 → 성과 개선 제안(규칙 기반, 나노 미호출)", { message: trimmed });
      setTurns((prev) =>
        prev.map((t) => (t.id === pendingTurn.id ? { ...t, pending: false, reply: improvementOutcome.reply } : t))
      );
      return;
    }

    // 예산 요청과 같은 이유로, 전환율·CTR·CPA·ROAS·지출 비교도 nano에 맡기지 않고 여기서 먼저 결정론적으로 처리한다.
    const performanceOutcome = handlePerformanceQuery(trimmed, allCampaigns);
    if (performanceOutcome.kind !== "not_query") {
      console.info("[assistant] 도구 분류 → 성과 조회(규칙 기반, 나노 미호출)", { message: trimmed });
      setTurns((prev) =>
        prev.map((t) => (t.id === pendingTurn.id ? { ...t, pending: false, reply: performanceOutcome.reply } : t))
      );
      return;
    }

    if (isPlainGreeting(trimmed)) {
      console.info("[assistant] 도구 분류 → 인사말(규칙 기반, 나노 미호출)", { message: trimmed });
      setTurns((prev) =>
        prev.map((t) => (t.id === pendingTurn.id ? { ...t, pending: false, reply: greetingReply() } : t))
      );
      return;
    }

    console.info("[assistant] 도구 분류 → 일반 대화(온디바이스 모델 호출 시도)", { message: trimmed });
    const { reply, engine: engineUsed } = await ask(trimmed, snapshots, turns);
    console.info("[assistant] 응답 완료", { engine: engineUsed });

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
                // 한글 등 IME 조합 중 Enter는 조합 확정용 키 입력이라, 이때 전송하면
                // 마지막 음절이 중복돼 보내진다(예: "안녕" → "안녕 녕"). 조합이 끝난 뒤에만 전송한다.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
            <Button type="submit" size="md" disabled={!input.trim() || busy || setup.saving}>
              전송
            </Button>
          </form>
        }
      >
        {focusedCampaign && (
          <div css={{ marginBottom: "0.5rem" }}>
            <Badge tone="blue">{focusedCampaign.name} 보는 중</Badge>
          </div>
        )}
        <AvailabilityBanner />
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
                {turn.engineUsed && (
                  <div css={{ marginTop: "-0.25rem" }}>
                    <EngineBadge engine={turn.engineUsed} />
                  </div>
                )}
                {turn.reply?.actions.map((action) => (
                  <ActionProposalCard key={action.id} action={action} onApply={applyAction} />
                ))}
                {turn.reply?.quickReplies && turn.reply.quickReplies.length > 0 && (
                  <QuickReplies items={turn.reply.quickReplies} onSelect={send} />
                )}
              </div>
            )
          )}
          {showSetup && (
            <CampaignSetupCard draft={setup.draft} onChange={setup.updateDraft} options={setup.options}
              loading={setup.loading} saving={setup.saving} error={setup.error} created={setup.created}
              onSubmit={setup.submit} onRetry={setup.reloadOptions} />
          )}
        </div>
        {turns.length <= 1 && (
          <div css={{ marginTop: "1rem" }}>
            <QuickReplies items={SUGGESTIONS} onSelect={send} />
          </div>
        )}
      </SlideOver>
    </>
  );
}
