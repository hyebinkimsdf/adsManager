"use client";

import { useSyncExternalStore } from "react";
import { CAMPAIGNS } from "./campaigns";
import type { Campaign, CampaignChannel } from "./types";

const STORAGE_KEY = "ads-dashboard-state-v1";

interface PersistedState {
  campaigns: Campaign[];
}

function cloneSeed(): Campaign[] {
  return CAMPAIGNS.map((c) => ({ ...c, targeting: { ...c.targeting } }));
}

let state: PersistedState = { campaigns: cloneSeed() };
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 스토리지 사용 불가 시 조용히 무시 — 화면 동작에는 영향 없음
  }
}

function normalize(campaigns: Campaign[]): Campaign[] {
  return campaigns.map((c) => {
    // 이전 스키마(단일 channel 필드)로 저장된 localStorage 데이터를 channels 배열로 이관한다.
    const legacy = c as Campaign & { channel?: CampaignChannel };
    const channels =
      Array.isArray(c.channels) && c.channels.length > 0
        ? c.channels
        : legacy.channel
          ? [legacy.channel]
          : (["search"] as CampaignChannel[]);
    return {
      ...c,
      channels,
      industry: c.industry ?? "etc",
      targeting: { ...c.targeting, keywords: c.targeting.keywords ?? [] },
    };
  });
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed?.campaigns?.length) {
        state = { campaigns: normalize(parsed.campaigns) };
      }
    }
  } catch {
    // 손상된 데이터는 무시하고 시드 데이터 유지
  }
  emit();
}

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  return () => listeners.delete(listener);
}

export function getSnapshot(): Campaign[] {
  return state.campaigns;
}

export function getServerSnapshot(): Campaign[] {
  return CAMPAIGNS;
}

export function useCampaigns(): Campaign[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCampaign(id: string): Campaign | undefined {
  const campaigns = useCampaigns();
  return campaigns.find((c) => c.id === id);
}

export function updateBudget(id: string, dailyBudget: number) {
  state = {
    campaigns: state.campaigns.map((c) =>
      c.id === id ? { ...c, dailyBudget: Math.max(0, Math.round(dailyBudget)) } : c
    ),
  };
  persist();
  emit();
}

export function adjustBudgetByPercent(id: string, percent: number) {
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign) return;
  updateBudget(id, campaign.dailyBudget * (1 + percent / 100));
}

export function setStatus(id: string, status: Campaign["status"]) {
  state = {
    campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, status } : c)),
  };
  persist();
  emit();
}

export function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  state = {
    campaigns: state.campaigns.map((c) =>
      c.id === id ? { ...c, targeting: { ...c.targeting, ...targeting } } : c
    ),
  };
  persist();
  emit();
}

export function adjustKeywordBidsByPercent(id: string, percent: number) {
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign || campaign.targeting.keywords.length === 0) return;
  const currentBids = campaign.targeting.keywordBids ?? {};
  const fallbackBid = 650; // 네이버 검색광고 기본 최소 입찰가 근사치
  const nextBids: Record<string, number> = { ...currentBids };
  for (const keyword of campaign.targeting.keywords) {
    const base = currentBids[keyword] ?? fallbackBid;
    nextBids[keyword] = Math.max(70, Math.round(base * (1 + percent / 100)));
  }
  updateTargeting(id, { keywordBids: nextBids });
}

export function addKeywords(id: string, keywords: string[]) {
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign) return;
  const merged = Array.from(new Set([...campaign.targeting.keywords, ...keywords]));
  updateTargeting(id, { keywords: merged });
}

export function addCampaign(campaign: Campaign) {
  state = { campaigns: [campaign, ...state.campaigns] };
  persist();
  emit();
}

export function deleteCampaign(id: string) {
  state = { campaigns: state.campaigns.filter((c) => c.id !== id) };
  persist();
  emit();
}

export function updateIndustry(id: string, industry: Campaign["industry"]) {
  state = {
    campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, industry } : c)),
  };
  persist();
  emit();
}

export function resetToSeed() {
  state = { campaigns: cloneSeed() };
  persist();
  emit();
}
