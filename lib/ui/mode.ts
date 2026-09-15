"use client";

import { getDefaultStore, useAtomValue } from "jotai";
import { atomWithStorage, createJSONStorage, unstable_withStorageValidator as withStorageValidator } from "jotai/utils";

export type UiMode = "simple" | "expert";

const STORAGE_KEY = "ads-dashboard-ui-mode-v1";
const isUiMode = (value: unknown): value is UiMode => value === "simple" || value === "expert";
// 손상된 저장값은 무시하고 기본값(simple)으로 되돌린다. atomWithStorage는 기본적으로 마운트 후에만
// localStorage를 읽어(getOnInit: false) 서버 렌더와 최초 클라이언트 렌더가 항상 "simple"로 일치한다.
const storage = withStorageValidator(isUiMode)(createJSONStorage<unknown>());
const modeAtom = atomWithStorage<UiMode>(STORAGE_KEY, "simple", storage);
const store = getDefaultStore();

export function useUiMode(): UiMode {
  return useAtomValue(modeAtom);
}

export function setUiMode(next: UiMode) {
  store.set(modeAtom, next);
}
