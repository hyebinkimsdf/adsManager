"use client";

import { useSyncExternalStore } from "react";

let open = false;
/** 캠페인 상세에서 열었을 때만 채워진다 — 채팅에서 대상을 안 밝혀도 이 캠페인을 기본 대상으로 쓴다. */
let focusedCampaignId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return open;
}

function getServerSnapshot(): boolean {
  return false;
}

function getFocusedSnapshot(): string | null {
  return focusedCampaignId;
}

function getFocusedServerSnapshot(): string | null {
  return null;
}

export function useAssistantDockOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAssistantDockFocusedCampaignId(): string | null {
  return useSyncExternalStore(subscribe, getFocusedSnapshot, getFocusedServerSnapshot);
}

/** campaignId를 주면 그 캠페인에 포커스한 채로 열고, 생략하면(예: 전역 ✨ 버튼) 포커스를 비운다. */
export function openAssistantDock(campaignId: string | null = null) {
  open = true;
  focusedCampaignId = campaignId;
  emit();
}

export function closeAssistantDock() {
  open = false;
  emit();
}
