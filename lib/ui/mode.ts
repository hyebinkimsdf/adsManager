"use client";

import { useSyncExternalStore } from "react";

export type UiMode = "simple" | "expert";

const STORAGE_KEY = "ads-dashboard-ui-mode-v1";

let mode: UiMode = "expert";
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // 스토리지 사용 불가 시 조용히 무시 — 화면 동작에는 영향 없음
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "simple" || raw === "expert") mode = raw;
  } catch {
    // 손상된 값은 무시하고 기본값 유지
  }
  emit();
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  return () => listeners.delete(listener);
}

function getSnapshot(): UiMode {
  return mode;
}

function getServerSnapshot(): UiMode {
  return "expert";
}

export function useUiMode(): UiMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setUiMode(next: UiMode) {
  mode = next;
  persist();
  emit();
}
