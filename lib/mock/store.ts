"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as repo from "./campaignsRepository";
import type { Campaign } from "./types";
import { buildDashboardSummary, type DashboardSummary } from "@/lib/insights";
import { replaceLast7Days, type TestPerformanceInput } from "@/lib/dev/testPerformanceData";

export const campaignsQueryKey = ["campaigns"] as const;
export const campaignSummaryQueryKey = ["campaigns", "summary"] as const;
const campaignDetailQueryKey = (id: string) => ["campaigns", "detail", id] as const;
const campaignBudgetAdjustmentsQueryKey = (id: string) => ["campaigns", "detail", id, "budget-adjustments"] as const;
const emptySummary = buildDashboardSummary([]);

// 서버 응답 전에는 예시 수치를 표시하지 않는다. 조회 상태와 실제 빈 결과를 구분한다.
export const campaignsQueryOptions = queryOptions({
  queryKey: campaignsQueryKey,
  queryFn: repo.getCampaigns,
});

export const campaignSummaryQueryOptions = queryOptions({
  queryKey: campaignSummaryQueryKey,
  queryFn: repo.getDashboardSummary,
});

export function campaignDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: campaignDetailQueryKey(id),
    queryFn: () => repo.getCampaign(id),
    // 목록에서 가져온 값의 조회 시점을 상세의 새 조회 시점으로 오인하지 않는다.
    placeholderData: () => getCachedCampaign(id),
    enabled: Boolean(id),
  });
}

export function campaignBudgetAdjustmentsQueryOptions(id: string) {
  return queryOptions({
    queryKey: campaignBudgetAdjustmentsQueryKey(id),
    queryFn: () => repo.getBudgetAdjustments(id),
    enabled: Boolean(id),
  });
}

export function useBudgetAdjustmentsQuery(id: string) {
  return useQuery(campaignBudgetAdjustmentsQueryOptions(id));
}

export function useCampaignsQuery() {
  return useQuery(campaignsQueryOptions);
}

export function useCampaignsSummaryQuery() {
  return useQuery(campaignSummaryQueryOptions);
}

export function useCampaignQuery(id: string) {
  return useQuery(campaignDetailQueryOptions(id));
}

export function useCampaigns(): Campaign[] {
  return useCampaignsQuery().data ?? [];
}

// 홈 대시보드 전용 — 캠페인 전체 배열이 아니라 서버가 미리 계산한 요약값만 받는다. 캠페인이
// 수천 건으로 늘어나도 응답 크기가 거의 일정해 초기 로딩이 캠페인 수에 영향받지 않는다.
export function useCampaignsSummary(): DashboardSummary {
  return useCampaignsSummaryQuery().data ?? emptySummary;
}

export function useCampaign(id: string): Campaign | undefined {
  const { data } = useCampaignQuery(id);
  return id ? data : undefined;
}

// 캠페인 목록 캐시를 직접 조작하는 쓰기 액션들. 컴포넌트 밖(applyAction 등 순수 함수)에서도
// 호출해야 해서 useMutation 대신 싱글턴 queryClient를 직접 갱신하는 방식을 쓴다.
//
// PATCH/POST 응답에는 이미 서버가 반영한 최신 캠페인이 담겨 있으므로, 캐시 배열 안의 해당 항목만
// 그 값으로 교체(또는 추가/제거)한다 — 매 변경마다 전체 목록을 다시 조회하지 않는다.
//
// 전체 배열 캐시(campaignsQueryKey)가 비어 있을 수도 있는 화면(예: 요약 응답만 쓰는 홈 화면)을
// 위해, 요약 캐시의 topCampaigns/recentCampaigns → 단건 상세 캐시 순으로 폴백해서 찾는다.
function getCachedCampaign(id: string): Campaign | undefined {
  const full = queryClient.getQueryData<Campaign[]>(campaignsQueryKey)?.find((c) => c.id === id);
  if (full) return full;
  const summary = queryClient.getQueryData<DashboardSummary>(campaignSummaryQueryKey);
  const fromSummary =
    summary?.topCampaigns.find((c) => c.id === id) ?? summary?.recentCampaigns.find((c) => c.id === id);
  if (fromSummary) return fromSummary;
  return queryClient.getQueryData<Campaign>(campaignDetailQueryKey(id));
}

// 순위/집계는 서버에서 다시 계산한다. 활성 요약은 즉시, 비활성 요약은 다음 접근에 조회한다.
// campaignId를 주면 그 캠페인의 예산 변경 이력도 함께 무효화한다(예산이 바뀌지 않은 수정에도 걸지만,
// 무효화는 활성 구독이 있을 때만 재조회를 일으키므로 상세 화면을 안 보고 있다면 비용이 없다).
function invalidateDerivedCaches(campaignId?: string) {
  void queryClient.invalidateQueries({ queryKey: campaignSummaryQueryKey, exact: true });
  if (campaignId) void queryClient.invalidateQueries({ queryKey: campaignBudgetAdjustmentsQueryKey(campaignId), exact: true });
}

async function cancelAffectedReads(id: string) {
  const wasRefreshingList = queryClient.getQueryState(campaignsQueryKey)?.fetchStatus === "fetching";
  // 변경 이전 GET이 늦게 도착해 최신 캐시를 덮지 못하게 한다.
  await Promise.all([
    queryClient.cancelQueries({ queryKey: campaignsQueryKey, exact: true }),
    queryClient.cancelQueries({ queryKey: campaignSummaryQueryKey, exact: true }),
    queryClient.cancelQueries({ queryKey: campaignDetailQueryKey(id), exact: true }),
  ]);
  return wasRefreshingList;
}

function updateCachedList(update: (campaigns: Campaign[]) => Campaign[], resumeRefresh: boolean) {
  const state = queryClient.getQueryState(campaignsQueryKey);
  queryClient.setQueryData<Campaign[]>(campaignsQueryKey, (prev) => prev === undefined ? undefined : update(prev), {
    // 한 항목의 변경으로 나머지 항목의 신선도까지 연장하지 않는다.
    updatedAt: state?.dataUpdatedAt,
  });
  if (state?.data === undefined || state.isInvalidated || resumeRefresh) {
    // 전체 목록을 아직 안 받았다면 단건 응답을 완전한 목록처럼 캐싱하지 않는다.
    // 변경 전 시작된 재조회도 최신 응답으로 다시 이어간다.
    void queryClient.invalidateQueries({ queryKey: campaignsQueryKey, exact: true });
  }
}

async function replaceCampaign(campaign: Campaign) {
  const resumeRefresh = await cancelAffectedReads(campaign.id);
  updateCachedList((prev) => prev.map((c) => (c.id === campaign.id ? campaign : c)), resumeRefresh);
  queryClient.setQueryData(campaignDetailQueryKey(campaign.id), campaign);
  invalidateDerivedCaches(campaign.id);
  return campaign;
}

async function applyUpdate(fn: () => Promise<Campaign>): Promise<Campaign> {
  return replaceCampaign(await fn());
}

// source를 남기면 서버가 예산 변경 이력(BudgetAdjustment)에 "사람이 직접 바꿨는지/추천을 적용한
// 건지"를 함께 기록한다 — 나중에 "이 변경이 효과가 있었는지" 볼 때 원인을 구분하는 근거가 된다.
export function updateBudget(id: string, dailyBudget: number) {
  return applyUpdate(() => repo.updateBudget(id, dailyBudget, { source: "manual" }));
}

export function adjustBudgetByPercent(id: string, percent: number, reasonKind?: "lower_budget" | "raise_budget") {
  const current = getCachedCampaign(id);
  if (!current) return Promise.reject(new Error("캠페인 정보를 불러오지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요."));
  const dailyBudget = Math.max(0, Math.round(current.dailyBudget * (1 + percent / 100)));
  return applyUpdate(() => repo.updateBudget(id, dailyBudget, { source: "recommendation", reasonKind }));
}

export function setStatus(id: string, status: Campaign["status"]) {
  return applyUpdate(() => repo.setStatus(id, status));
}

export function updateTargeting(id: string, targeting: Partial<Campaign["targeting"]>) {
  const current = getCachedCampaign(id);
  if (!current) return Promise.reject(new Error("캠페인 정보를 불러오지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요."));
  return applyUpdate(() => repo.updateTargeting(id, { ...current.targeting, ...targeting }));
}

export async function addCampaign(campaign: Campaign) {
  const created = await repo.addCampaign(campaign);
  const resumeRefresh = await cancelAffectedReads(created.id);
  updateCachedList((prev) => [created, ...prev.filter((c) => c.id !== created.id)], resumeRefresh);
  queryClient.setQueryData(campaignDetailQueryKey(created.id), created);
  invalidateDerivedCaches();
  return created;
}

export async function deleteCampaign(id: string) {
  await repo.deleteCampaign(id);
  const resumeRefresh = await cancelAffectedReads(id);
  updateCachedList((prev) => prev.filter((c) => c.id !== id), resumeRefresh);
  queryClient.removeQueries({ queryKey: campaignDetailQueryKey(id) });
  invalidateDerivedCaches();
}

export function updateIndustry(id: string, industry: Campaign["industry"]) {
  return applyUpdate(() => repo.updateIndustry(id, industry));
}

// 테스트 전용 — 실제 매체 연동이 없어 실적이 저절로 안 쌓이니, "확인해 볼 광고 설정" 섹션이 데이터
// 변화에 실제로 반응하는지 확인해보려고 최근 7일 실적을 원하는 값으로 강제로 채워 넣는다. DB에
// 그대로 저장된다(로컬 미리보기가 아님) — components/dashboard/PerformanceTestInjector.tsx가 쓴다.
export function setTestPerformanceData(id: string, input: TestPerformanceInput) {
  const current = getCachedCampaign(id);
  if (!current) return Promise.reject(new Error("캠페인 정보를 불러오지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요."));
  return applyUpdate(() => repo.updateHistory(id, replaceLast7Days(current.history, input)));
}

export async function resetToSeed() {
  const campaigns = await repo.resetToSeed();
  await queryClient.cancelQueries({ queryKey: campaignsQueryKey });
  queryClient.removeQueries({ queryKey: ["campaigns", "detail"] });
  queryClient.setQueryData(campaignsQueryKey, campaigns);
  invalidateDerivedCaches();
  return campaigns;
}
