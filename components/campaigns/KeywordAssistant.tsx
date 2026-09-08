/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  HiSparkles,
  HiXMark,
  HiOutlineInformationCircle,
  HiArrowPath,
  HiOutlineTag,
  HiOutlineSparkles,
  HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AvailabilityBanner } from "@/components/assistant/AvailabilityBanner";
import { ChatBubble } from "@/components/assistant/ChatBubble";
import { OptionCard, OptionGrid } from "@/components/campaigns/OptionCard";
import { useKeywordAssistant } from "@/lib/ai/useKeywordAssistant";
import {
  fetchKeywordBidEstimates,
  fetchPositionEstimate,
  type KeywordBidEstimateDto,
} from "@/lib/ai/naverBidClient";
import { INDUSTRY_SEED_KEYWORD, INDUSTRY_TAILS, OBJECTIVE_TAILS } from "@/lib/ai/keywordHeuristics";
import { formatCompactKRW, formatKRW } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { IconType } from "react-icons";
import type { KeywordSuggestion } from "@/lib/ai/types";
import type { CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

interface CoreKeywordCandidate {
  label: string;
  desc: string;
  keyword: string;
  icon: IconType;
  color: string;
  bg: string;
}

// INDUSTRY_TAILS 일부 항목은 이미 업종 시드 단어를 포함한다(예: food의 "맛집", medical의 "병원 후기").
// 그대로 이어붙이면 "맛집 맛집", "병원 병원 후기"처럼 중복되므로, 겹치는 접두어는 제거하고 붙인다.
function combineWithoutDuplication(seed: string, tail: string): string {
  const stripped = tail.startsWith(seed) ? tail.slice(seed.length).trim() : tail;
  return stripped ? `${seed} ${stripped}` : seed;
}

// 업종·목표·캠페인 이름 정보만으로 바로 고를 수 있는 핵심 키워드 후보 3가지를 만든다.
// 직접 타이핑하지 않아도 되도록, 이미 아는 정보로 그럴듯한 검색어 형태를 조합한다.
function buildCoreKeywordCandidates(industry: CampaignIndustry, objective: CampaignObjective, name: string): CoreKeywordCandidate[] {
  const seed = INDUSTRY_SEED_KEYWORD[industry];
  // OBJECTIVE_LABEL("리드 수집" 등 내부 마케팅 용어)은 실제 검색어로 부자연스러워서,
  // 실사용자가 검색할 법한 수식어(OBJECTIVE_TAILS)를 붙인 조합을 대신 쓴다.
  const seedWithObjective = `${seed} ${OBJECTIVE_TAILS[objective][0]}`;

  // 업종 수식어 중 시드 단어와 겹치지 않고(예: food의 "맛집") 위 카드와도 겹치지 않는 첫 후보를 고른다.
  let seedWithTail = seed;
  for (const tail of INDUSTRY_TAILS[industry]) {
    const candidate = combineWithoutDuplication(seed, tail);
    if (candidate !== seed && candidate !== seedWithObjective) {
      seedWithTail = candidate;
      break;
    }
  }
  if (seedWithTail === seed && OBJECTIVE_TAILS[objective][1]) {
    // 업종 수식어가 전부 위 카드와 겹쳤다면 목표 수식어의 다음 후보로 대신한다.
    seedWithTail = `${seed} ${OBJECTIVE_TAILS[objective][1]}`;
  }
  const trimmedName = name.trim();

  const candidates: CoreKeywordCandidate[] = [
    {
      label: "업종 키워드",
      desc: `가장 기본적인 검색어예요`,
      keyword: seed,
      icon: HiOutlineTag,
      color: "var(--color-blue-600)",
      bg: "var(--color-blue-50)",
    },
    trimmedName
      ? {
          label: "캠페인 이름 기반",
          desc: "입력한 캠페인 이름을 그대로 써요",
          keyword: trimmedName,
          icon: HiOutlineSparkles,
          color: "var(--color-violet-600)",
          bg: "var(--color-violet-50)",
        }
      : {
          label: "업종 + 목표 키워드",
          desc: "목표에 맞춰 조합한 키워드예요",
          keyword: seedWithObjective,
          icon: HiOutlineSparkles,
          color: "var(--color-violet-600)",
          bg: "var(--color-violet-50)",
        },
    {
      label: "구체적인 키워드",
      desc: "실제 검색어에 더 가까운 조합이에요",
      keyword: seedWithTail,
      icon: HiOutlineMagnifyingGlass,
      color: "var(--color-green-600)",
      bg: "var(--color-green-50)",
    },
  ];

  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.keyword)) return false;
    seen.add(c.keyword);
    return true;
  });
}

const MATCH_TYPE_LABEL: Record<KeywordSuggestion["matchType"], string> = {
  broad: "확장",
  phrase: "구문",
  exact: "일치",
};

const COMPETITION_LABEL: Record<NonNullable<KeywordSuggestion["competition"]>, string> = {
  low: "경쟁 낮음",
  medium: "경쟁 중간",
  high: "경쟁 높음",
};

const COMPETITION_TONE: Record<NonNullable<KeywordSuggestion["competition"]>, "green" | "blue" | "red"> = {
  low: "green",
  medium: "blue",
  high: "red",
};

type ScaleKey = "small" | "medium" | "bulk";

const SCALE_OPTIONS: {
  key: ScaleKey;
  label: string;
  note: string;
  limit: number;
  recommended?: boolean;
}[] = [
  { key: "small", label: "적게", note: "핵심 위주로 좁게, 관리가 쉬워요", limit: 8 },
  { key: "medium", label: "추천", note: "적당히 넓게, 균형 잡힌 선택이에요", limit: 30, recommended: true },
  { key: "bulk", label: "많이", note: "최대한 넓게, 관리 손이 많이 가요", limit: 300 },
];

const BUDGET_STATUS = {
  under: { tone: "green" as const, label: "여유 있어요" },
  fit: { tone: "blue" as const, label: "예산에 딱 맞아요" },
  over: { tone: "red" as const, label: "예산을 넘어요" },
};

type BudgetPlanKey = "save" | "balanced" | "max";

interface BudgetPlan {
  key: BudgetPlanKey;
  label: string;
  desc: string;
  keywords: string[];
  bids: Record<string, number>;
  totalCost: number;
  totalClicks: number;
  /** 네이버 실데이터 기반 비용 추정치가 있을 때만 true. false면 비용/클릭/예산 상태는 표시하지 않는다. */
  hasCost: boolean;
  status: keyof typeof BUDGET_STATUS | null;
}

// extraRatio는 예산 전체가 아니라 "핵심 키워드 비용을 뺀 나머지 예산" 중 서브 키워드에 얼마나 쓸지의 비율이다.
// 예산 전체에 곱하면 핵심 키워드만으로 이미 예산을 넘는 경우 세 안 모두 서브 키워드를 하나도 못 담아
// 완전히 똑같아져 버리므로, 남는 예산 기준으로 비율을 나눠야 예산이 빠듯할 때도 안끼리 차이가 생긴다.
const PLAN_META: Record<BudgetPlanKey, { label: string; desc: string; extraRatio: number }> = {
  save: { label: "절약형", desc: "예산을 아끼면서 핵심 키워드 위주로 담아요", extraRatio: 0.4 },
  balanced: { label: "균형형", desc: "예산에 맞춰 최대한 여러 키워드를 담아요", extraRatio: 1.0 },
  max: { label: "최대노출형", desc: "예산을 조금 넘더라도 최대한 넓게 담아요", extraRatio: 1.6 },
};

const SUB_PREVIEW_COUNT = 40;

const inputStyle = css`
  flex: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: white;
  padding: 0.625rem 0.875rem;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: var(--color-blue-500);
  }
`;

const linkButtonStyle = css`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-blue-600);
  &:hover {
    text-decoration: underline;
  }
`;

const keywordChipStyle = (active: boolean) => css`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
  background-color: ${active ? "var(--color-blue-50)" : "white"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-700)"};
  padding: 0.375rem 0.75rem;
  font-size: 13px;
  font-weight: 500;
  transition: border-color 150ms;

  ${!active &&
  `
    &:hover {
      border-color: var(--color-blue-500);
    }
  `}
`;

const chipMetaStyle = css`
  border-radius: 9999px;
  background-color: var(--color-gray-100);
  padding: 0.125rem 0.375rem;
  font-size: 10px;
  color: var(--color-gray-500);
`;

const positionChipStyle = (active: boolean) => css`
  border-radius: 9999px;
  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
  background-color: ${active ? "var(--color-blue-50)" : "transparent"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-500)"};
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  font-weight: 500;
  transition: border-color 150ms;

  ${!active &&
  `
    &:hover {
      border-color: var(--color-blue-500);
    }
  `}
`;

export function KeywordAssistant({
  objective,
  channels,
  industry,
  name,
  selected,
  onChange,
  onBidsChange,
  onBudgetEstimate,
  onConfirm,
  confirmLabel = "다음",
  dailyBudget = null,
  targetPosition = 3,
}: {
  objective: CampaignObjective;
  channels: CampaignChannel[];
  industry: CampaignIndustry;
  name: string;
  selected: string[];
  onChange: (keywords: string[]) => void;
  onBidsChange?: (bids: Record<string, number>) => void;
  onBudgetEstimate?: (dailyCost: number) => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  /** 하루 예산(원). 지정하면 AI가 이 예산 안에서 자동으로 키워드를 담아준다. */
  dailyBudget?: number | null;
  /** 원하는 노출 순위(1/3/5). 자동 담기 시 이 순위 기준 입찰가로 비용을 계산한다. */
  targetPosition?: number;
}) {
  const { state, downloadProgress, suggest } = useKeywordAssistant();
  // 이미 저장된 키워드를 가지고 마운트되면(예: 캠페인 상세 페이지) 처음부터 다시 물어보지 않고
  // 바로 review 단계로 보여준다. 완전히 새로 만드는 캠페인은 selected가 비어 있어 core부터 시작한다.
  const [kwStep, setKwStep] = useState<"core" | "scale" | "review">(
    selected.length > 0 ? "review" : "core"
  );
  const [draft, setDraft] = useState("");
  const [bids, setBids] = useState<Record<string, number>>({});
  const [positionCost, setPositionCost] = useState<Record<string, { clicks: number; cost: number }>>({});
  const [positionLoading, setPositionLoading] = useState<Record<string, boolean>>({});
  const [customPosition, setCustomPosition] = useState<Record<string, string>>({});
  const [scale, setScale] = useState<ScaleKey>("medium");
  const [subExpanded, setSubExpanded] = useState(false);
  const [coreKeywordDraft, setCoreKeywordDraft] = useState("");
  const [coreKeywordInputs, setCoreKeywordInputs] = useState<string[]>([]);
  const [showManualCoreInput, setShowManualCoreInput] = useState(false);
  const coreKeywordCandidates = buildCoreKeywordCandidates(industry, objective, name);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[] | null>(null);
  const [chosenPlanKey, setChosenPlanKey] = useState<BudgetPlanKey | "manual" | null>(null);
  const [plansPending, setPlansPending] = useState(false);
  const [plansIdentical, setPlansIdentical] = useState(false);

  const bidEstimatesMutation = useMutation({
    mutationFn: (keywords: string[]) => fetchKeywordBidEstimates(keywords),
  });
  const positionMutation = useMutation({
    mutationFn: (vars: { keyword: string; position: number }) =>
      fetchPositionEstimate(vars.keyword, vars.position),
  });
  const bidEstimates = bidEstimatesMutation.data ?? null;
  const bidsLoading = bidEstimatesMutation.isPending;
  const bidsAsked = bidEstimatesMutation.isSuccess;

  const suggestMutation = useMutation({
    mutationFn: (vars: { coreKeywords: string[]; limit: number }) =>
      suggest({ objective, channels, industry, name, coreKeywords: vars.coreKeywords }, { limit: vars.limit }),
    onSuccess: async (result) => {
      setBudgetPlans(null);
      setChosenPlanKey(null);
      setPlansIdentical(false);
      if (result.reply.keywords.length === 0) return;
      if (result.engine === "naver-ads" && dailyBudget) {
        await prepareBudgetPlans(result.reply.keywords, dailyBudget);
      } else {
        prepareSimpleDirections(result.reply.keywords);
      }
    },
  });
  const suggestions = suggestMutation.data?.reply.keywords ?? [];
  const engine = suggestMutation.data?.engine ?? null;
  const suggesting = suggestMutation.isPending;
  const preparingDirections = plansPending;
  const loading = suggesting || preparingDirections;
  const hasAsked = suggestMutation.isSuccess;
  const directionsReady = !loading && budgetPlans !== null && budgetPlans.length > 0;
  const awaitingPlanChoice = directionsReady && chosenPlanKey === null;
  // 방향 카드를 고르거나 건너뛰기 전까지는(또는 애초에 카드를 만들 수 없었다면) 기존 수동 편집 패널을 숨긴다.
  // 그렇지 않으면 로딩 중에 "직접 키워드 추가" 입력창과 "다음" 버튼이 어정쩡하게 함께 보이는 문제가 있었다.
  const showManualPanel = !loading && (chosenPlanKey !== null || !directionsReady);

  const coreSuggestions = suggestions.filter((s) => s.tier !== "sub");
  const subSuggestions = suggestions.filter((s) => s.tier === "sub");

  // 각 키워드의 중간 입찰가 기준 예상치를, 목표 순위의 입찰가 비율만큼 근사해서 환산한다.
  // (순위별 클릭·비용을 매번 새로 조회하지 않고, 이미 받아온 데이터로 계산)
  function estimateForPosition(e: KeywordBidEstimateDto, position: number) {
    const posBid = e.positionBids.find((p) => p.position === position)?.bid ?? e.medianBid;
    const ratio = e.medianBid > 0 ? posBid / e.medianBid : 1;
    // 검색량이 낮은 롱테일 키워드는 네이버 성과 예측(클릭·비용)이 데이터 부족으로 0을 주는 경우가 많다.
    // 그대로 두면 "공짜"로 착각해 무제한으로 담게 되므로, 하루 1클릭은 발생한다고 가정한 입찰가를 하한선으로 쓴다.
    const cost = e.estimatedDailyCost > 0 ? e.estimatedDailyCost * ratio : posBid;
    const clicks = e.estimatedDailyClicks > 0 ? e.estimatedDailyClicks * ratio : 1;
    return { bid: posBid, cost, clicks };
  }

  // 실검색 데이터(네이버) 기반 추천이고 예산이 주어졌을 때만, 예산 대비 서로 다른 3가지 구성안(절약/균형/최대노출)을
  // 미리 계산해서 카드로 보여준다. 핵심 키워드는 사용자가 직접 입력한 키워드이므로 비용과 무관하게 항상 담고,
  // 남은 예산은 서브 키워드를 저렴한 것부터 채워서 최대한 여러 개가 담기게 한다.
  // (검색량 순으로만 담으면 비싼 키워드 한둘이 예산을 다 써버려 서브 키워드가 거의 안 담긴다)
  async function prepareBudgetPlans(list: KeywordSuggestion[], budget: number) {
    setPlansPending(true);
    try {
      const estimates = await bidEstimatesMutation.mutateAsync(list.map((s) => s.keyword));
      if (!estimates || estimates.length === 0) {
        // 비용 추정치를 못 받아왔어도 방향 선택 자체는 계속 제공한다(비용/클릭 정보 없이).
        prepareSimpleDirections(list);
        return;
      }

      const estByKeyword = new Map(estimates.map((e) => [e.keyword, e]));

      // 핵심 키워드는 사용자가 직접 입력한 키워드이므로, 네이버가 해당 키워드의 입찰가 추정치를
      // 못 주더라도(검색량이 낮아 데이터가 없는 경우 등) 절대 빠지지 않고 항상 포함시킨다.
      const core = list
        .filter((s) => s.tier !== "sub")
        .map((s) => {
          const est = estByKeyword.get(s.keyword);
          return est ? { s, ...estimateForPosition(est, targetPosition) } : { s, bid: 0, cost: 0, clicks: 0 };
        });

      // 서브 키워드는 예산 안에서 저렴한 것부터 채우는 방식이라 비용 추정치가 있어야만 의미가 있다.
      const subs = list
        .filter((s) => s.tier === "sub")
        .map((s) => {
          const est = estByKeyword.get(s.keyword);
          if (!est) return null;
          return { s, ...estimateForPosition(est, targetPosition) };
        })
        .filter((x): x is { s: KeywordSuggestion; bid: number; cost: number; clicks: number } => x !== null)
        .sort((a, b) => a.cost - b.cost);

      const coreCost = core.reduce((sum, x) => sum + x.cost, 0);
      // 핵심 키워드 비용을 빼고 남는 예산. 핵심 키워드만으로 이미 예산을 다 썼거나 넘겼으면 0이 되고,
      // 이 경우 세 안 모두 서브 키워드를 담을 여유가 없어 자연스럽게 핵심 키워드만 남는다(아래 UI에서 별도 처리).
      const extraBudget = Math.max(0, budget - coreCost);

      function fill(extraRatio: number) {
        const cap = coreCost + extraBudget * extraRatio;
        const nextBids: Record<string, number> = {};
        const picked: string[] = [];
        let total = 0;
        let clicks = 0;
        for (const { s, bid, cost, clicks: c } of core) {
          picked.push(s.keyword);
          nextBids[s.keyword] = bid;
          total += cost;
          clicks += c;
        }
        for (const { s, bid, cost, clicks: c } of subs) {
          if (total + cost <= cap) {
            picked.push(s.keyword);
            nextBids[s.keyword] = bid;
            total += cost;
            clicks += c;
          }
        }
        return { keywords: picked, bids: nextBids, totalCost: total, totalClicks: clicks };
      }

      function statusFor(total: number): BudgetPlan["status"] {
        if (total <= budget * 0.9) return "under";
        if (total <= budget * 1.1) return "fit";
        return "over";
      }

      const plans: BudgetPlan[] = (Object.keys(PLAN_META) as BudgetPlanKey[]).map((key) => {
        const meta = PLAN_META[key];
        const filled = fill(meta.extraRatio);
        return { key, label: meta.label, desc: meta.desc, ...filled, hasCost: true, status: statusFor(filled.totalCost) };
      });

      applyDirectionPlans(plans);
    } finally {
      setPlansPending(false);
    }
  }

  // 예산/네이버 비용 데이터가 없을 때(온디바이스·미리보기 폴백, 예산 미설정 등)도 키워드를 하나씩 고르게
  // 하는 대신 몇 가지 구성 방향을 바로 제시한다. 네트워크 호출 없이 이미 받아온 추천 목록만으로 계산한다.
  function prepareSimpleDirections(list: KeywordSuggestion[]) {
    const coreKeywords = list.filter((s) => s.tier !== "sub").map((s) => s.keyword);
    const subKeywords = list.filter((s) => s.tier === "sub").map((s) => s.keyword);
    const topSubs = subKeywords.slice(0, 8);

    const plans: BudgetPlan[] = [
      {
        key: "save",
        label: "핵심만 담기",
        desc: "가장 확실한 핵심 키워드만 간단하게 담아요",
        keywords: coreKeywords,
        bids: {},
        totalCost: 0,
        totalClicks: 0,
        hasCost: false,
        status: null,
      },
      {
        key: "balanced",
        label: "핵심 + 추천 서브",
        desc: "핵심 키워드에 자주 쓰는 서브 키워드를 더해요",
        keywords: Array.from(new Set([...coreKeywords, ...topSubs])),
        bids: {},
        totalCost: 0,
        totalClicks: 0,
        hasCost: false,
        status: null,
      },
      {
        key: "max",
        label: "폭넓게 담기",
        desc: "추천된 키워드를 모두 담아 최대한 넓게 노출해요",
        keywords: Array.from(new Set([...coreKeywords, ...subKeywords])),
        bids: {},
        totalCost: 0,
        totalClicks: 0,
        hasCost: false,
        status: null,
      },
    ];

    applyDirectionPlans(plans);
  }

  function applyDirectionPlans(plans: BudgetPlan[]) {
    // 세 안이 결과적으로 완전히 똑같다면(핵심 키워드 비용만으로 이미 예산을 다 썼거나, 서브 후보가 없는 경우)
    // 카드 3개를 나란히 보여줄 이유가 없다 — 오히려 혼란스럽다. 이 경우엔 카드 대신 단일 안내로 보여준다.
    const signature = (p: BudgetPlan) => p.keywords.join(",");
    const allIdentical = plans.every((p) => signature(p) === signature(plans[0]));
    setPlansIdentical(allIdentical);
    setBudgetPlans(plans);
  }

  function choosePlan(plan: BudgetPlan) {
    onChange(plan.keywords);
    setBids(plan.bids);
    onBidsChange?.(plan.bids);
    onBudgetEstimate?.(plan.totalCost);
    setChosenPlanKey(plan.key);
  }

  function skipPlans() {
    setChosenPlanKey("manual");
  }

  function handleSuggest(scaleOverride?: ScaleKey) {
    if (coreKeywordInputs.length === 0) return;
    setSubExpanded(false);
    bidEstimatesMutation.reset();
    setPositionCost({});
    const activeScale = scaleOverride ?? scale;
    const limit = SCALE_OPTIONS.find((o) => o.key === activeScale)!.limit;
    suggestMutation.mutate({ coreKeywords: coreKeywordInputs, limit });
  }

  function addCoreKeyword() {
    const value = coreKeywordDraft.trim();
    setCoreKeywordDraft("");
    if (!value || coreKeywordInputs.includes(value)) return;
    setCoreKeywordInputs((prev) => [...prev, value]);
  }

  function removeCoreKeyword(keyword: string) {
    setCoreKeywordInputs((prev) => prev.filter((k) => k !== keyword));
  }

  function submitCoreKeyword() {
    // "추가" 버튼을 안 누르고 바로 다음으로 넘어가도 입력 중이던 키워드를 놓치지 않도록 포함한다.
    const draft = coreKeywordDraft.trim();
    const finalKeywords = draft && !coreKeywordInputs.includes(draft) ? [...coreKeywordInputs, draft] : coreKeywordInputs;
    if (finalKeywords.length === 0) return;
    setCoreKeywordInputs(finalKeywords);
    setCoreKeywordDraft("");
    setKwStep("scale");
  }

  function chooseCoreCandidate(keyword: string) {
    setCoreKeywordInputs([keyword]);
    setKwStep("scale");
  }

  function chooseScale(key: ScaleKey) {
    setScale(key);
    setKwStep("review");
    handleSuggest(key);
  }

  async function handleEstimateBids() {
    setPositionCost({});
    const result = await bidEstimatesMutation.mutateAsync(selected);
    if (result) {
      const nextBids: Record<string, number> = {};
      let totalDailyCost = 0;
      for (const e of result) {
        nextBids[e.keyword] = bids[e.keyword] ?? e.medianBid;
        totalDailyCost += e.estimatedDailyCost;
      }
      setBids(nextBids);
      onBidsChange?.(nextBids);
      onBudgetEstimate?.(totalDailyCost);
    }
  }

  function costOf(e: KeywordBidEstimateDto): number {
    return positionCost[e.keyword]?.cost ?? e.estimatedDailyCost;
  }

  function computeTotal(costs: Record<string, { clicks: number; cost: number }>): number {
    if (!bidEstimates) return 0;
    return bidEstimates
      .filter((e) => selected.includes(e.keyword))
      .reduce((sum, e) => sum + (costs[e.keyword]?.cost ?? e.estimatedDailyCost), 0);
  }

  function updateBid(keyword: string, value: number) {
    const next = { ...bids, [keyword]: value };
    setBids(next);
    onBidsChange?.(next);
  }

  // 순위 프리셋 칩과 직접 입력한 순위 모두 이 핸들러로 처리해, 입찰가와 하루 예상 비용을 함께 갱신한다.
  // 여러 키워드에 대해 동시에 순위를 조회할 수 있어 로딩 상태는 키워드별로 따로 추적한다
  // (단일 useMutation 인스턴스의 isPending은 마지막 호출 기준이라 동시 호출을 구분하지 못함).
  async function applyPosition(keyword: string, position: number) {
    setPositionLoading((prev) => ({ ...prev, [keyword]: true }));
    const result = await positionMutation.mutateAsync({ keyword, position });
    setPositionLoading((prev) => ({ ...prev, [keyword]: false }));
    if (!result) return;

    updateBid(keyword, result.bid);
    const nextCosts = {
      ...positionCost,
      [keyword]: { clicks: result.estimatedDailyClicks, cost: result.estimatedDailyCost },
    };
    setPositionCost(nextCosts);
    onBudgetEstimate?.(computeTotal(nextCosts));
  }

  function toggle(keyword: string) {
    onChange(selected.includes(keyword) ? selected.filter((k) => k !== keyword) : [...selected, keyword]);
  }

  function applyAllSuggested() {
    onChange(Array.from(new Set([...selected, ...suggestions.map((s) => s.keyword)])));
  }

  function applyCoreOnly() {
    onChange(Array.from(new Set([...selected, ...coreSuggestions.map((s) => s.keyword)])));
  }

  function renderKeywordChip(s: KeywordSuggestion) {
    const active = selected.includes(s.keyword);
    return (
      <button key={s.keyword} type="button" onClick={() => toggle(s.keyword)} css={keywordChipStyle(active)}>
        {s.keyword}
        {s.monthlySearches !== undefined ? (
          <>
            <span css={chipMetaStyle}>월 {formatCompactKRW(s.monthlySearches)}회</span>
            {s.competition && (
              <Badge tone={COMPETITION_TONE[s.competition]} css={{ padding: "0.125rem 0.375rem", fontSize: 10 }}>
                {COMPETITION_LABEL[s.competition]}
              </Badge>
            )}
          </>
        ) : (
          <span css={chipMetaStyle}>{MATCH_TYPE_LABEL[s.matchType]}</span>
        )}
      </button>
    );
  }

  function addCustom() {
    const value = draft.trim();
    setDraft("");
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
  }

  const summary = (() => {
    if (!bidEstimates) return null;
    const rows = bidEstimates.filter((e) => selected.includes(e.keyword));
    if (rows.length === 0) return null;
    let cost = 0;
    let clicks = 0;
    for (const e of rows) {
      const override = positionCost[e.keyword];
      if (override) {
        cost += override.cost;
        clicks += override.clicks;
      } else {
        const est = estimateForPosition(e, targetPosition);
        cost += est.cost;
        clicks += est.clicks;
      }
    }
    const status: keyof typeof BUDGET_STATUS | null =
      dailyBudget == null ? null : cost <= dailyBudget * 0.9 ? "under" : cost <= dailyBudget * 1.1 ? "fit" : "over";
    return { cost, clicks, count: rows.length, status };
  })();

  // 캠페인 생성 마법사에서 이어져 오는 대화 흐름일 때만 보여준다. 이미 선택된 키워드를 가지고
  // 조용히 review로 시작한 경우(예: 캠페인 상세 페이지)에는 매번 처음부터 물어보지 않는다.
  const showWizardTrail = kwStep !== "review" || hasAsked;

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {showWizardTrail && (
        <>
      <ChatBubble role="assistant">
        {kwStep !== "core" || showManualCoreInput
          ? "핵심 키워드가 뭔가요? 여러 개 입력해도 좋아요."
          : "핵심 키워드를 추천해드릴게요. 마음에 드는 걸 골라주세요."}
      </ChatBubble>
      {kwStep === "core" ? (
        showManualCoreInput ? (
          <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div css={{ display: "flex", gap: "0.5rem" }}>
              <input
                value={coreKeywordDraft}
                onChange={(e) => setCoreKeywordDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCoreKeyword();
                  }
                }}
                placeholder="예: 강남 필라테스"
                css={inputStyle}
                autoFocus
              />
              <Button type="button" size="md" variant="secondary" disabled={!coreKeywordDraft.trim()} onClick={addCoreKeyword}>
                추가
              </Button>
            </div>

            {coreKeywordInputs.length > 0 && (
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {coreKeywordInputs.map((k) => (
                  <span
                    key={k}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.25rem;
                      border-radius: 9999px;
                      background-color: var(--color-blue-50);
                      padding: 0.25rem 0.375rem 0.25rem 0.625rem;
                      font-size: 12px;
                      font-weight: 500;
                      color: var(--color-blue-600);
                    `}
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => removeCoreKeyword(k)}
                      aria-label={`${k} 제거`}
                      css={css`
                        border-radius: 9999px;
                        padding: 0.125rem;
                        &:hover {
                          background-color: var(--color-blue-100);
                        }
                      `}
                    >
                      <HiXMark style={{ height: "0.75rem", width: "0.75rem" }} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>
              입력한 키워드마다 위치·가격·상담 등을 조합해 실제 입찰 가능한 서브 키워드로 확장해요
            </span>

            <div css={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Button
                type="button"
                size="md"
                disabled={coreKeywordInputs.length === 0 && !coreKeywordDraft.trim()}
                onClick={submitCoreKeyword}
              >
                다음
              </Button>
              <button type="button" onClick={() => setShowManualCoreInput(false)} css={linkButtonStyle}>
                추천 카드로 돌아가기
              </button>
            </div>
          </div>
        ) : (
          <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <OptionGrid columns={3}>
              {coreKeywordCandidates.map((c) => (
                <OptionCard
                  key={c.keyword}
                  icon={c.icon}
                  iconBg={c.bg}
                  iconColor={c.color}
                  label={c.label}
                  desc={
                    <>
                      {c.desc}
                      <br />
                      <span css={{ fontWeight: 600, color: "var(--color-gray-700)" }}>&ldquo;{c.keyword}&rdquo;</span>
                    </>
                  }
                  onClick={() => chooseCoreCandidate(c.keyword)}
                />
              ))}
            </OptionGrid>
            <button
              type="button"
              onClick={() => setShowManualCoreInput(true)}
              css={css`
                display: flex;
                width: fit-content;
                align-items: center;
                gap: 0.375rem;
                border-radius: 9999px;
                border: 1px solid var(--border-subtle);
                padding: 0.5rem 0.875rem;
                font-size: 13px;
                font-weight: 500;
                color: var(--color-gray-600);

                &:hover {
                  border-color: var(--color-blue-500);
                  color: var(--color-blue-600);
                }
              `}
            >
              <HiOutlinePencilSquare style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
              직접 입력하기
            </button>
          </div>
        )
      ) : (
        <ChatBubble role="user" onClick={() => setKwStep("core")}>
          {coreKeywordInputs.join(", ")}
        </ChatBubble>
      )}

      {kwStep !== "core" && (
        <>
          <ChatBubble role="assistant">몇 개 정도 추천받을까요?</ChatBubble>
          {kwStep === "scale" ? (
            <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseScale(opt.key)}
                    css={css`
                      display: flex;
                      flex-direction: column;
                      gap: 0.125rem;
                      border-radius: var(--radius-md);
                      border: 1px solid var(--border-subtle);
                      padding: 0.625rem 0.875rem;
                      text-align: left;
                      transition: border-color 150ms, background-color 150ms;

                      &:hover {
                        border-color: var(--color-blue-500);
                        background-color: var(--color-blue-50);
                      }
                    `}
                  >
                    <span css={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                      {opt.label}
                      {opt.recommended && (
                        <Badge tone="blue" css={{ padding: "0 0.375rem", fontSize: 9 }}>
                          추천
                        </Badge>
                      )}
                    </span>
                    <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ChatBubble role="user" onClick={() => setKwStep("scale")}>
              {SCALE_OPTIONS.find((o) => o.key === scale)?.label}
            </ChatBubble>
          )}
        </>
      )}
        </>
      )}

      {kwStep === "review" && (
        <>
          {showWizardTrail && (
            <ChatBubble role="assistant">
              {suggesting
                ? "AI가 키워드를 찾고 있어요..."
                : preparingDirections
                ? "예산에 맞춰 구성안을 정리하고 있어요..."
                : awaitingPlanChoice
                ? budgetPlans?.[0]?.hasCost
                  ? "예산에 맞는 구성안을 준비했어요. 마음에 드는 걸 골라주세요."
                  : "몇 가지 방향으로 추천해봤어요. 마음에 드는 걸 골라주세요."
                : "예산과 순위에 맞게 키워드를 담아봤어요. 필요하면 빼거나 더해주세요."}
            </ChatBubble>
          )}

          {loading && (
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.625rem;
                border-radius: var(--radius-md);
                border: 1px solid var(--border-subtle);
                background-color: var(--color-gray-50);
                padding: 1.5rem 0.875rem;
              `}
            >
              <HiArrowPath
                css={css`
                  height: 1.25rem;
                  width: 1.25rem;
                  color: var(--color-blue-500);
                  animation: spin 1s linear infinite;
                  @keyframes spin {
                    from {
                      transform: rotate(0deg);
                    }
                    to {
                      transform: rotate(360deg);
                    }
                  }
                `}
                aria-hidden="true"
              />
              <p css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>
                {suggesting ? "AI가 키워드를 찾고 있어요..." : "구성안을 정리하고 있어요..."}
              </p>
              <div css={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} css={{ height: "2rem", width: "5rem" }} />
                ))}
              </div>
            </div>
          )}

          {awaitingPlanChoice && budgetPlans && (
            <BudgetPlanCards
              plans={budgetPlans}
              identical={plansIdentical}
              dailyBudget={dailyBudget}
              onChoose={choosePlan}
              onSkip={skipPlans}
            />
          )}

          {showManualPanel && (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              border-radius: var(--radius-md);
              border: 1px solid var(--border-subtle);
              background-color: var(--color-gray-50);
              padding: 0.875rem;
            `}
          >
            {!loading && suggestions.length > 0 && (
              <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => handleSuggest()}
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--color-blue-600);
                    &:hover {
                      text-decoration: underline;
                    }
                  `}
                >
                  <HiSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                  다시 추천받기
                </button>
                <div css={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {subSuggestions.length > 0 && (
                    <button type="button" onClick={applyCoreOnly} css={linkButtonStyle}>
                      핵심만 적용
                    </button>
                  )}
                  <button type="button" onClick={applyAllSuggested} css={linkButtonStyle}>
                    추천 전체 적용
                  </button>
                </div>
              </div>
            )}

            {!loading && suggestions.length === 0 && !hasAsked && (
              <button
                type="button"
                onClick={() => setKwStep("core")}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.25rem;
                  align-self: flex-start;
                  font-size: 12px;
                  font-weight: 500;
                  color: var(--color-blue-600);
                  &:hover {
                    text-decoration: underline;
                  }
                `}
              >
                <HiSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
                AI로 새로 추천받기
              </button>
            )}

            {hasAsked && !loading && engine === "naver-ads" && (
              <div css={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0 0.25rem", fontSize: 12, color: "var(--color-gray-500)" }}>
                <Badge tone="green">실검색 데이터</Badge>
                <span>네이버 검색광고의 월간 검색수·경쟁정도를 기반으로 추천해요</span>
              </div>
            )}
            {hasAsked && !loading && engine !== "naver-ads" && (
              <AvailabilityBanner state={state} downloadProgress={downloadProgress} />
            )}

            {!loading && suggestions.length > 0 && (
              <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {subSuggestions.length === 0 ? (
                  <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{coreSuggestions.map(renderKeywordChip)}</div>
                ) : (
                  <>
                    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <span css={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)" }}>
                        핵심 키워드 ({coreSuggestions.length})
                      </span>
                      <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{coreSuggestions.map(renderKeywordChip)}</div>
                    </div>
                    <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <span css={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)" }}>
                        서브 키워드 ({subSuggestions.length})
                      </span>
                      <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {(subExpanded ? subSuggestions : subSuggestions.slice(0, SUB_PREVIEW_COUNT)).map(
                          renderKeywordChip
                        )}
                      </div>
                      {subSuggestions.length > SUB_PREVIEW_COUNT && (
                        <button
                          type="button"
                          onClick={() => setSubExpanded((v) => !v)}
                          css={[linkButtonStyle, css`align-self: flex-start;`]}
                        >
                          {subExpanded ? "접기" : `서브 키워드 ${subSuggestions.length - SUB_PREVIEW_COUNT}개 더보기`}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div css={{ display: "flex", gap: "0.5rem" }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="직접 키워드 추가"
                css={inputStyle}
              />
              <Button type="button" size="md" variant="secondary" disabled={!draft.trim()} onClick={addCustom}>
                추가
              </Button>
            </div>

            {selected.length > 0 && (
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {selected.map((k) => (
                  <span
                    key={k}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.25rem;
                      border-radius: 9999px;
                      background-color: var(--color-blue-50);
                      padding: 0.25rem 0.375rem 0.25rem 0.625rem;
                      font-size: 12px;
                      font-weight: 500;
                      color: var(--color-blue-600);
                    `}
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => toggle(k)}
                      aria-label={`${k} 제거`}
                      css={css`
                        border-radius: 9999px;
                        padding: 0.125rem;
                        &:hover {
                          background-color: var(--color-blue-100);
                        }
                      `}
                    >
                      <HiXMark style={{ height: "0.75rem", width: "0.75rem" }} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {summary && (
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.375rem;
                  border-radius: var(--radius-sm);
                  border: 1px solid var(--border-subtle);
                  background: white;
                  padding: 0.75rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>AI 추천 요약</span>
                  {summary.status && (
                    <Badge tone={BUDGET_STATUS[summary.status].tone}>{BUDGET_STATUS[summary.status].label}</Badge>
                  )}
                </div>
                <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
                  선택한 키워드 {summary.count}개 · 하루 약 {formatCompactKRW(summary.clicks)}번 클릭될 것으로 예상돼요
                </p>
                <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
                  하루 예상 비용 약 {formatKRW(summary.cost)}원
                  {dailyBudget != null && <> (예산 {formatKRW(dailyBudget)}원 중)</>}
                </p>
              </div>
            )}

            {selected.length > 0 && (
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                  border-radius: var(--radius-sm);
                  border: 1px solid var(--border-subtle);
                  background: white;
                  padding: 0.75rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>키워드별 단가 · 예상 예산</span>
                  <Button type="button" size="sm" variant="secondary" onClick={handleEstimateBids} disabled={bidsLoading}>
                    {bidsAsked ? "다시 계산" : "예상 단가 확인"}
                  </Button>
                </div>

                {bidsLoading && (
                  <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {selected.map((k) => (
                      <Skeleton key={k} css={{ height: "2.25rem", width: "100%" }} />
                    ))}
                  </div>
                )}

                {!bidsLoading && bidsAsked && !bidEstimates && (
                  <p css={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                    네이버 검색광고 API 연동이 안 돼 있어 단가를 예측할 수 없어요. 예산은 직접 정해주세요.
                  </p>
                )}

                {!bidsLoading && bidEstimates && (
                  <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {bidEstimates
                      .filter((e) => selected.includes(e.keyword))
                      .map((e, i, arr) => (
                        <div
                          key={e.keyword}
                          css={css`
                            display: flex;
                            flex-direction: column;
                            gap: 0.25rem;
                            padding-bottom: 0.5rem;
                            ${i < arr.length - 1 && "border-bottom: 1px solid var(--border-subtle);"}
                          `}
                        >
                          <div css={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                            <span
                              css={css`
                                min-width: 0;
                                flex: 1;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                                font-weight: 500;
                                color: var(--color-gray-700);
                              `}
                            >
                              {e.keyword}
                            </span>
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>최소 {formatKRW(e.minBid)}원</span>
                            <input
                              type="number"
                              value={bids[e.keyword] ?? e.medianBid}
                              onChange={(ev) => updateBid(e.keyword, Number(ev.target.value))}
                              css={css`
                                width: 6rem;
                                flex-shrink: 0;
                                border-radius: var(--radius-sm);
                                border: 1px solid var(--border-subtle);
                                padding: 0.25rem 0.5rem;
                                text-align: right;
                                outline: none;
                                &:focus {
                                  border-color: var(--color-blue-500);
                                }
                              `}
                            />
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>원</span>
                            <span css={{ flexShrink: 0, color: "var(--color-gray-400)" }}>
                              일 {formatCompactKRW(costOf(e))}원 예상
                            </span>
                          </div>
                          {e.positionBids.length > 0 && (
                            <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", paddingLeft: "0.125rem" }}>
                              <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>순위별 입찰가</span>
                              {e.positionBids.map((p) => {
                                const active = bids[e.keyword] === p.bid;
                                return (
                                  <button
                                    key={p.position}
                                    type="button"
                                    onClick={() => applyPosition(e.keyword, p.position)}
                                    disabled={positionLoading[e.keyword]}
                                    css={positionChipStyle(active)}
                                  >
                                    {p.position}위 {formatCompactKRW(p.bid)}원
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", paddingLeft: "0.125rem" }}>
                            <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>직접 순위 입력</span>
                            <input
                              type="number"
                              min={1}
                              value={customPosition[e.keyword] ?? ""}
                              onChange={(ev) =>
                                setCustomPosition((prev) => ({ ...prev, [e.keyword]: ev.target.value }))
                              }
                              placeholder="예: 7"
                              css={css`
                                width: 3.5rem;
                                border-radius: var(--radius-sm);
                                border: 1px solid var(--border-subtle);
                                padding: 0.125rem 0.375rem;
                                font-size: 11px;
                                outline: none;
                                &:focus {
                                  border-color: var(--color-blue-500);
                                }
                              `}
                            />
                            <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>위</span>
                            <button
                              type="button"
                              disabled={!customPosition[e.keyword] || positionLoading[e.keyword]}
                              onClick={() => applyPosition(e.keyword, Number(customPosition[e.keyword]))}
                              css={css`
                                border-radius: 9999px;
                                border: 1px solid var(--border-subtle);
                                padding: 0.125rem 0.5rem;
                                font-size: 11px;
                                font-weight: 500;
                                color: var(--color-gray-500);
                                &:hover {
                                  border-color: var(--color-blue-500);
                                }
                                &:disabled {
                                  opacity: 0.4;
                                }
                              `}
                            >
                              확인
                            </button>
                            {positionLoading[e.keyword] && (
                              <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>계산 중…</span>
                            )}
                            {!positionLoading[e.keyword] &&
                              Number(customPosition[e.keyword]) > 0 &&
                              bids[e.keyword] &&
                              positionCost[e.keyword] && (
                                <span css={{ fontSize: 11, color: "var(--color-blue-600)" }}>
                                  → 입찰가 {formatKRW(bids[e.keyword])}원 · 일{" "}
                                  {formatCompactKRW(positionCost[e.keyword].cost)}원 예상
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    <div
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-top: 1px solid var(--border-subtle);
                        padding-top: 0.5rem;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--color-gray-900);
                      `}
                    >
                      <span>설정 단가 기준 하루 예상 총 비용</span>
                      <span>{formatKRW(computeTotal(positionCost))}원</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {onConfirm && (
              <Button type="button" size="md" onClick={onConfirm} css={{ alignSelf: "flex-start" }}>
                {confirmLabel}
              </Button>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}

function BudgetPlanCards({
  plans,
  identical,
  dailyBudget,
  onChoose,
  onSkip,
}: {
  plans: BudgetPlan[];
  identical: boolean;
  dailyBudget: number | null;
  onChoose: (plan: BudgetPlan) => void;
  onSkip: () => void;
}) {
  if (identical) {
    const plan = plans[0];
    const status = plan.status ? BUDGET_STATUS[plan.status] : null;
    return (
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          background-color: white;
          padding: 1rem;
        `}
      >
        <div css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <HiOutlineInformationCircle
            style={{ height: "1.125rem", width: "1.125rem", flexShrink: 0, color: "var(--color-gray-400)", marginTop: 2 }}
            aria-hidden="true"
          />
          <p css={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
            {plan.status === "over"
              ? "핵심 키워드만으로 이미 예산을 넘어서, 서브 키워드를 더 담을 여유가 없어요. 예산을 늘리거나 핵심 키워드 수를 줄이면 더 다양하게 담을 수 있어요."
              : "서브 키워드로 담을 만한 후보가 없어서, 안을 나눌 필요 없이 핵심 키워드만으로 구성했어요."}
          </p>
        </div>

        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            border-radius: var(--radius-sm);
            background-color: var(--color-gray-50);
            padding: 0.625rem;
          `}
        >
          <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>키워드</span>
            <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>{plan.keywords.length}개</span>
          </div>
          {plan.hasCost && (
            <>
              <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>하루 예상 비용</span>
                <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>{formatKRW(plan.totalCost)}원</span>
              </div>
              <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>하루 예상 클릭</span>
                <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>
                  {formatCompactKRW(plan.totalClicks)}회
                </span>
              </div>
            </>
          )}
        </div>

        {status && (
          <Badge tone={status.tone} css={{ alignSelf: "flex-start" }}>
            {status.label}
          </Badge>
        )}

        <div css={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Button type="button" size="md" onClick={() => onChoose(plan)}>
            이대로 담기
          </Button>
          <button type="button" onClick={onSkip} css={[linkButtonStyle, css`align-self: center;`]}>
            직접 골라볼게요
          </button>
        </div>
        {dailyBudget != null && (
          <p css={{ fontSize: 11, color: "var(--color-gray-400)" }}>일 예산 {formatKRW(dailyBudget)}원 기준으로 계산했어요</p>
        )}
      </div>
    );
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.625rem;
          @media (min-width: 640px) {
            grid-template-columns: repeat(3, 1fr);
          }
        `}
      >
        {plans.map((plan) => {
          const status = plan.status ? BUDGET_STATUS[plan.status] : null;
          const isRecommended = plan.key === "balanced";
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onChoose(plan)}
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                border-radius: var(--radius-md);
                border: 1.5px solid ${isRecommended ? "var(--color-blue-500)" : "var(--border-subtle)"};
                background-color: ${isRecommended ? "var(--color-blue-50)" : "white"};
                padding: 0.875rem;
                text-align: left;
                transition: border-color 150ms, box-shadow 150ms;

                &:hover {
                  border-color: var(--color-blue-500);
                  box-shadow: var(--shadow-card);
                }
              `}
            >
              <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <span css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{plan.label}</span>
                {isRecommended && (
                  <Badge tone="blue" css={{ fontSize: 10, padding: "0.125rem 0.375rem" }}>
                    추천
                  </Badge>
                )}
              </div>
              <p css={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-gray-500)" }}>{plan.desc}</p>

              <div
                css={css`
                  margin-top: 0.125rem;
                  display: flex;
                  flex-direction: column;
                  gap: 0.25rem;
                  border-radius: var(--radius-sm);
                  background-color: var(--color-gray-50);
                  padding: 0.625rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>키워드</span>
                  <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>{plan.keywords.length}개</span>
                </div>
                {plan.hasCost && (
                  <>
                    <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>하루 예상 비용</span>
                      <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>
                        {formatKRW(plan.totalCost)}원
                      </span>
                    </div>
                    <div css={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>하루 예상 클릭</span>
                      <span css={{ fontSize: 13, fontWeight: 700, color: "var(--color-gray-900)" }}>
                        {formatCompactKRW(plan.totalClicks)}회
                      </span>
                    </div>
                  </>
                )}
              </div>

              {status && (
                <Badge tone={status.tone} css={{ alignSelf: "flex-start" }}>
                  {status.label}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onSkip} css={[linkButtonStyle, css`align-self: flex-start;`]}>
        직접 골라볼게요
      </button>
      {dailyBudget != null && (
        <p css={{ fontSize: 11, color: "var(--color-gray-400)" }}>일 예산 {formatKRW(dailyBudget)}원 기준으로 계산했어요</p>
      )}
    </div>
  );
}
