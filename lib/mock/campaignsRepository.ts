import { CAMPAIGNS } from "./campaigns";
import type { Campaign, CampaignChannel } from "./types";

const STORAGE_KEY = "ads-dashboard-state-v1";

interface PersistedState {
  campaigns: Campaign[];
}

function cloneSeed(): Campaign[] {
  return CAMPAIGNS.map((c) => ({ ...c, targeting: { ...c.targeting } }));
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

function readFromStorage(): Campaign[] {
  if (typeof window === "undefined") return cloneSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed?.campaigns?.length) return normalize(parsed.campaigns);
    }
  } catch {
    // 손상된 데이터는 무시하고 시드 데이터 유지
  }
  return cloneSeed();
}

function writeToStorage(campaigns: Campaign[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ campaigns } satisfies PersistedState));
  } catch {
    // 스토리지 사용 불가 시 조용히 무시 — 화면 동작에는 영향 없음
  }
}

async function commit(updater: (campaigns: Campaign[]) => Campaign[]): Promise<Campaign[]> {
  const next = updater(readFromStorage());
  writeToStorage(next);
  return next;
}

// 서버 렌더링 및 쿼리의 initialData로 즉시 쓸 수 있는 동기 시드 스냅샷.
export function getCampaignsSeed(): Campaign[] {
  return cloneSeed();
}

export async function getCampaigns(): Promise<Campaign[]> {
  return readFromStorage();
}

export function updateBudget(id: string, dailyBudget: number) {
  return commit((campaigns) =>
    campaigns.map((c) => (c.id === id ? { ...c, dailyBudget: Math.max(0, Math.round(dailyBudget)) } : c))
  );
}

export function adjustBudgetByPercent(id: string, percent: number) {
  return commit((campaigns) => {
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return campaigns;
    const dailyBudget = Math.max(0, Math.round(campaign.dailyBudget * (1 + percent / 100)));
    return campaigns.map((c) => (c.id === id ? { ...c, dailyBudget } : c));
  });
}

export function setStatus(id: string, status: Campaign["status"]) {
  return commit((campaigns) => campaigns.map((c) => (c.id === id ? { ...c, status } : c)));
}

export function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  return commit((campaigns) =>
    campaigns.map((c) => (c.id === id ? { ...c, targeting: { ...c.targeting, ...targeting } } : c))
  );
}

export function adjustKeywordBidsByPercent(id: string, percent: number) {
  return commit((campaigns) => {
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign || campaign.targeting.keywords.length === 0) return campaigns;
    const currentBids = campaign.targeting.keywordBids ?? {};
    const fallbackBid = 650; // 네이버 검색광고 기본 최소 입찰가 근사치
    const nextBids: Record<string, number> = { ...currentBids };
    for (const keyword of campaign.targeting.keywords) {
      const base = currentBids[keyword] ?? fallbackBid;
      nextBids[keyword] = Math.max(70, Math.round(base * (1 + percent / 100)));
    }
    return campaigns.map((c) =>
      c.id === id ? { ...c, targeting: { ...c.targeting, keywordBids: nextBids } } : c
    );
  });
}

export function addKeywords(id: string, keywords: string[]) {
  return commit((campaigns) => {
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return campaigns;
    const merged = Array.from(new Set([...campaign.targeting.keywords, ...keywords]));
    return campaigns.map((c) =>
      c.id === id ? { ...c, targeting: { ...c.targeting, keywords: merged } } : c
    );
  });
}

export function addCampaign(campaign: Campaign) {
  return commit((campaigns) => [campaign, ...campaigns]);
}

export function deleteCampaign(id: string) {
  return commit((campaigns) => campaigns.filter((c) => c.id !== id));
}

export function updateIndustry(id: string, industry: Campaign["industry"]) {
  return commit((campaigns) => campaigns.map((c) => (c.id === id ? { ...c, industry } : c)));
}

export function resetToSeed() {
  return commit(() => cloneSeed());
}
