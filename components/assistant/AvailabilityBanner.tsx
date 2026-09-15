/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAiPreparation } from "@/components/providers/OnDeviceAiProvider";
import { HiOutlineCpuChip, HiOutlineCheckCircle, HiOutlineExclamationTriangle } from "react-icons/hi2";
import type { AiExecutionStage, AiFailureReason } from "@/lib/ai/onDeviceAiRuntime";

const executionStages: Record<AiExecutionStage, string> = {
  preparing: "AI 준비 중", session: "대화 준비 중", "translate-input": "질문 읽는 중",
  inference: "나노가 답하는 중", parse: "답변 확인 중", "translate-output": "답변 다듬는 중",
};
const failureMessages: Record<AiFailureReason, string> = {
  unsupported: "이 브라우저는 나노를 지원하지 않아요", "not-ready": "나노 준비가 끝나지 않았어요",
  session: "나노를 실행하지 못했어요", timeout: "나노 응답이 오래 걸렸어요",
  "invalid-response": "나노 답변을 읽지 못했어요", failed: "나노 처리에 실패했어요", cancelled: "요청을 취소했어요",
};

const rowStyle = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  font-size: 12px;
  color: var(--color-gray-600);
`;

export function AvailabilityBanner() {
  const { state, resources, features, executions, prepare, runtime } = useAiPreparation();
  const messages = {
    idle: "대화 AI 준비를 기다리고 있어요",
    checking: "이 브라우저에서 대화 AI를 사용할 수 있는지 확인하고 있어요",
    downloadable: "대화 AI를 준비하려면 시작 버튼을 눌러주세요",
    downloading: "대화 AI와 번역 도구를 내려받고 있어요",
    initializing: "대화 AI와 번역 도구를 실행할 준비를 하고 있어요",
    available: "나노 준비 완료 · 답변마다 사용 여부를 표시해요",
    unsupported: "이 브라우저에서는 나노 없이 기본 기능을 사용해요",
    error: "대화 AI 준비에 실패했어요. 다시 시도해 주세요",
  };
  const featureStates = {
    idle: "준비 대기",
    checking: "지원 확인 중",
    downloadable: "시작 필요",
    downloading: "다운로드 중",
    initializing: "실행 준비 중",
    available: "사용 가능",
    unsupported: "지원되지 않음",
    error: "준비 실패",
  };
  return (
    <div css={rowStyle}>
      <Badge tone={state === "available" ? "green" : state === "unsupported" || state === "error" ? "gray" : "blue"}>
        <HiOutlineCpuChip aria-hidden="true" /> {state === "available" ? "나노 준비 완료" : state === "unsupported" ? "기본 모드" : "AI 준비"}
      </Badge>
      <span role="status">{messages[state]}</span>
      {(state === "downloadable" || state === "error") && (
        <Button type="button" size="sm" variant="secondary" onClick={() => { void prepare(); }}>
          {state === "error" ? "대화 AI 다시 시도" : "AI 사용 시작"}
        </Button>
      )}
      {features.slice(1).filter((feature) => feature.active).map((feature) => (
        <span key={feature.id} css={css`display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.375rem;`}>
          <span role="status">{feature.label} · {featureStates[feature.state]}</span>
          {(feature.state === "downloadable" || feature.state === "error") && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={`${feature.label} ${feature.state === "error" ? "다시 시도" : "사용 시작"}`}
              onClick={() => { void runtime.prepareFeatureById(feature.id); }}
            >
              {feature.state === "error" ? "다시 시도" : "사용 시작"}
            </Button>
          )}
        </span>
      ))}
      {resources.filter((resource) => resource.state === "downloading"
        && (resource.id === "ko-en" || resource.id === "en-ko" || features.some((feature) => feature.id === resource.id && feature.active))).map((resource) => (
        <span key={resource.id}>{resource.label} · {resource.progress}%</span>
      ))}
      {executions.filter((execution) => features.some((feature) => feature.id === execution.featureId && feature.active)).map((execution) => (
        <span key={execution.featureId} role="status" css={css`display: inline-flex; align-items: center; gap: 0.25rem; width: 100%;`}>
          {execution.outcome === "running" ? <HiOutlineCpuChip aria-hidden="true" /> : execution.outcome === "success" ? <HiOutlineCheckCircle aria-hidden="true" /> : <HiOutlineExclamationTriangle aria-hidden="true" />}
          {execution.label} · {execution.outcome === "running" ? executionStages[execution.stage]
            : execution.outcome === "success" ? `최근 나노 처리 완료 · ${(execution.durationMs / 1000).toFixed(1)}초`
              : execution.outcome === "cancelled" ? "요청 취소"
                : `${failureMessages[execution.reason ?? "failed"]} · 기본 처리로 전환`}
        </span>
      ))}
    </div>
  );
}
