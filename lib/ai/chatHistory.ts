"use client";

import { atomWithStorage } from "jotai/utils";
import type { ChatTurn } from "./types";

const STORAGE_KEY = "adsManager.assistant.turns";

export const WELCOME_TURN: ChatTurn = {
  id: "welcome",
  role: "assistant",
  reply: {
    reply: "안녕하세요! 캠페인 성과 확인부터 예산 조정까지 대화로 도와드릴게요.",
    actions: [],
  },
};

// 응답 대기 중(pending) 턴은 새로고침 시 영영 멈춰 보이므로 저장 대상에서 뺀다.
const chatHistoryStorage = {
  getItem(key: string, initialValue: ChatTurn[]): ChatTurn[] {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? (parsed as ChatTurn[]) : initialValue;
    } catch {
      // 저장된 값이 손상됐거나 스토리지를 쓸 수 없는 환경 — 초기값으로 시작한다.
      return initialValue;
    }
  },
  setItem(key: string, value: ChatTurn[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value.filter((turn) => !turn.pending)));
    } catch {
      // 프라이빗 모드 등 스토리지를 쓸 수 없는 환경 — 대화는 이번 세션에서만 유지된다.
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** 새로고침·재방문에도 대화가 이어지도록 대화 기록을 로컬 스토리지와 동기화하는 atom. */
export const chatTurnsAtom = atomWithStorage<ChatTurn[]>(STORAGE_KEY, [WELCOME_TURN], chatHistoryStorage);
