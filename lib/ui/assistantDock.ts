"use client";

import { atom, getDefaultStore, useAtomValue } from "jotai";

const openAtom = atom(false);
/** 캠페인 상세에서 열었을 때만 채워진다 — 채팅에서 대상을 안 밝혀도 이 캠페인을 기본 대상으로 쓴다. */
const focusedCampaignIdAtom = atom<string | null>(null);
// Provider 없이 쓰는 기본 스토어 — 컴포넌트 밖(이벤트 핸들러 등)에서 값을 바꿀 때 필요하다.
const store = getDefaultStore();

export function useAssistantDockOpen(): boolean {
  return useAtomValue(openAtom);
}

export function useAssistantDockFocusedCampaignId(): string | null {
  return useAtomValue(focusedCampaignIdAtom);
}

/** campaignId를 주면 그 캠페인에 포커스한 채로 열고, 생략하면(예: 전역 ✨ 버튼) 포커스를 비운다. */
export function openAssistantDock(campaignId: string | null = null) {
  store.set(openAtom, true);
  store.set(focusedCampaignIdAtom, campaignId);
}

export function closeAssistantDock() {
  store.set(openAtom, false);
}
