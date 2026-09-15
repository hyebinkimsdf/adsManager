/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineArrowLeft, HiOutlineBellAlert, HiOutlineQuestionMarkCircle, HiOutlineCursorArrowRays, HiSparkles } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useCampaigns } from "@/lib/mock/store";
import { useRewardCampaigns, createRewardCampaign } from "@/lib/reward/useRewardCampaigns";
import { useConversionEvents } from "@/lib/tracking/useConversionEvents";
import { buildRewardRecommendations, type RewardRecommendation } from "@/lib/reward/insights";
import {
  PRODUCT_LABEL,
  MONEY_NOTIFICATION_MIN_TARGET_SIZE,
  LUCKY_QUIZ_MIN_BUDGET,
  LUCKY_QUIZ_MAX_BUDGET,
  BUTTON_PRESS_MIN_DAILY_BUDGET,
  computeMoneyNotificationCpp,
  validateRewardDraft,
} from "@/lib/reward/rules";
import { formatKRW } from "@/lib/format";
import type { RewardCampaign, RewardProductType } from "@/lib/mock/types";

const PRODUCT_ICON: Record<RewardProductType, typeof HiOutlineBellAlert> = {
  money_notification: HiOutlineBellAlert,
  lucky_quiz: HiOutlineQuestionMarkCircle,
  button_press: HiOutlineCursorArrowRays,
};

const inputStyle = css`
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--color-gray-50);
  padding: 0.625rem 0.875rem;
  font-size: 14px;
  outline: none;
  &:focus {
    border-color: var(--color-blue-500);
  }
`;

const pillStyle = (active: boolean) => css`
  border-radius: 9999px;
  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
  background-color: ${active ? "var(--color-blue-50)" : "white"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-700)"};
  padding: 0.375rem 0.75rem;
  font-size: 13px;
  font-weight: 500;
`;

function nextId() {
  return `reward-${Date.now()}`;
}

export default function NewRewardCampaignPage() {
  const router = useRouter();
  const campaigns = useCampaigns();
  const rewardCampaigns = useRewardCampaigns();
  const events = useConversionEvents();
  const recommendations = useMemo(
    () => buildRewardRecommendations(campaigns, rewardCampaigns, events),
    [campaigns, rewardCampaigns, events]
  );

  const [productType, setProductType] = useState<RewardProductType | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variant, setVariant] = useState<"basic" | "live">("basic");
  const [targetSize, setTargetSize] = useState(String(MONEY_NOTIFICATION_MIN_TARGET_SIZE));
  const [advancedTargeting, setAdvancedTargeting] = useState(false);
  const [dailyBudget, setDailyBudget] = useState("100000");

  const [totalBudget, setTotalBudget] = useState(String(LUCKY_QUIZ_MIN_BUDGET));

  const [creativeType, setCreativeType] = useState<"button" | "catalog">("button");
  const [landingUrl, setLandingUrl] = useState("");

  function applyRecommendation(rec: RewardRecommendation) {
    setProductType(rec.productType);
    setName(rec.draft.name);
    if (rec.draft.productType === "money_notification") {
      setVariant(rec.draft.variant);
      setTargetSize(String(rec.draft.targetSize));
      setAdvancedTargeting(rec.draft.advancedTargeting);
      setDailyBudget(String(rec.draft.dailyBudget));
    } else if (rec.draft.productType === "lucky_quiz") {
      setTotalBudget(String(rec.draft.totalBudget));
    } else {
      setCreativeType(rec.draft.creativeType);
      setDailyBudget(String(rec.draft.dailyBudget));
    }
  }

  const draft: Partial<RewardCampaign> | null = useMemo(() => {
    if (!productType) return null;
    if (productType === "money_notification") {
      return {
        name,
        productType,
        variant,
        targetSize: Number(targetSize) || 0,
        advancedTargeting,
        dailyBudget: Number(dailyBudget) || 0,
      };
    }
    if (productType === "lucky_quiz") {
      return { name, productType, totalBudget: Number(totalBudget) || 0 };
    }
    return { name, productType, creativeType, landingUrl, dailyBudget: Number(dailyBudget) || 0 };
  }, [productType, name, variant, targetSize, advancedTargeting, dailyBudget, totalBudget, creativeType, landingUrl]);

  const validationError = draft ? validateRewardDraft(draft) : "먼저 상품을 선택해주세요.";

  async function handleCreate() {
    if (!draft || !productType || validationError) return;
    setSaving(true);
    setError(null);
    try {
      const base = { id: nextId(), name: name.trim(), status: "active" as const, createdAt: new Date().toISOString() };
      let campaign: RewardCampaign;
      if (productType === "money_notification") {
        campaign = { ...base, productType, variant, targetSize: Number(targetSize), advancedTargeting, dailyBudget: Number(dailyBudget) };
      } else if (productType === "lucky_quiz") {
        campaign = { ...base, productType, totalBudget: Number(totalBudget) };
      } else {
        campaign = { ...base, productType, creativeType, landingUrl, dailyBudget: Number(dailyBudget) };
      }
      await createRewardCampaign(campaign);
      router.push("/campaigns/reward");
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "42rem" }}>
      <div>
        <button
          type="button"
          onClick={() => router.push("/campaigns/reward")}
          css={css`
            display: flex;
            align-items: center;
            gap: 0.25rem;
            margin-bottom: 0.5rem;
            font-size: 13px;
            color: var(--color-gray-600);
            &:hover {
              color: var(--color-gray-700);
            }
          `}
        >
          <HiOutlineArrowLeft style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" /> 리워드 광고
        </button>
        <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>새 리워드 캠페인</h1>
      </div>

      <Card css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <CardHeader>
          <CardTitle>
            <span css={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <HiSparkles style={{ height: "1rem", width: "1rem", color: "var(--color-blue-500)" }} aria-hidden="true" /> AI 추천 방향
            </span>
          </CardTitle>
        </CardHeader>
        <p css={{ marginTop: "-0.5rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>
          지금 운영 중인 캠페인 성과와 전환 데이터를 분석해서 효율적일 것으로 보이는 순서예요.
        </p>
        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
            @media (min-width: 640px) {
              grid-template-columns: repeat(3, 1fr);
            }
          `}
        >
          {recommendations.map((rec, i) => {
            const Icon = PRODUCT_ICON[rec.productType];
            const selected = productType === rec.productType;
            return (
              <div
                key={rec.productType}
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.625rem;
                  border-radius: var(--radius-md);
                  border: 1.5px solid ${selected ? "var(--color-blue-500)" : "var(--border-subtle)"};
                  background-color: ${selected ? "var(--color-blue-50)" : "white"};
                  padding: 1rem;
                `}
              >
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    css={{
                      display: "flex",
                      height: "2.25rem",
                      width: "2.25rem",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "9999px",
                      backgroundColor: "var(--color-blue-50)",
                    }}
                  >
                    <Icon style={{ height: "1.125rem", width: "1.125rem", color: "var(--color-blue-600)" }} aria-hidden="true" />
                  </span>
                  {i === 0 && <Badge tone="blue">추천</Badge>}
                </div>
                <div>
                  <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{PRODUCT_LABEL[rec.productType]}</p>
                  <p css={{ marginTop: "0.125rem", fontSize: 11.5, color: "var(--color-gray-400)" }}>효율 점수 {rec.score}점</p>
                </div>
                <p css={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--color-gray-600)", flex: 1 }}>{rec.detail}</p>
                <Button size="sm" variant={selected ? "primary" : "secondary"} onClick={() => applyRecommendation(rec)}>
                  {selected ? "선택됨" : "이 방향으로 시작하기"}
                </Button>
              </div>
            );
          })}
        </div>

        {productType && (
          <>
            <div>
              <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                캠페인 이름
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="캠페인 이름을 입력해주세요" css={inputStyle} />
            </div>

            {productType === "money_notification" && (
              <>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>유형</label>
                  <div css={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" css={pillStyle(variant === "basic")} onClick={() => setVariant("basic")}>일반형</button>
                    <button type="button" css={pillStyle(variant === "live")} onClick={() => setVariant("live")}>라이브형</button>
                  </div>
                </div>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                    타겟 규모 (최소 {formatKRW(MONEY_NOTIFICATION_MIN_TARGET_SIZE)}명)
                  </label>
                  <input value={targetSize} onChange={(e) => setTargetSize(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" css={inputStyle} />
                </div>
                <label css={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, color: "var(--color-gray-700)" }}>
                  <input type="checkbox" checked={advancedTargeting} onChange={(e) => setAdvancedTargeting(e.target.checked)} />
                  업종·관심사 등 추가 타겟 조건 사용 (CPP +10원)
                </label>
                <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-blue-50)", padding: "0.75rem 0.875rem" }}>
                  <span css={{ fontSize: 12.5, color: "var(--color-blue-700)" }}>예상 CPP</span>
                  <span css={{ fontSize: 15, fontWeight: 700, color: "var(--color-blue-700)" }}>{computeMoneyNotificationCpp(advancedTargeting)}원</span>
                </div>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>일 예산</label>
                  <input value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" css={inputStyle} />
                </div>
              </>
            )}

            {productType === "lucky_quiz" && (
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  전체 예산 ({formatKRW(LUCKY_QUIZ_MIN_BUDGET)}원 ~ {formatKRW(LUCKY_QUIZ_MAX_BUDGET)}원)
                </label>
                <input value={totalBudget} onChange={(e) => setTotalBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" css={inputStyle} />
                <p css={{ marginTop: "0.375rem", fontSize: 12, color: "var(--color-gray-400)" }}>
                  성인타겟 업종은 집행할 수 없어요. 혜택탭 전체 유저에게 논타겟으로 노출돼요.
                </p>
              </div>
            )}

            {productType === "button_press" && (
              <>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>소재 유형</label>
                  <div css={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" css={pillStyle(creativeType === "button")} onClick={() => setCreativeType("button")}>버튼강조형</button>
                    <button type="button" css={pillStyle(creativeType === "catalog")} onClick={() => setCreativeType("catalog")}>카탈로그형</button>
                  </div>
                </div>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>랜딩 URL</label>
                  <input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://" css={inputStyle} />
                </div>
                <div>
                  <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                    일 예산 (최소 {formatKRW(BUTTON_PRESS_MIN_DAILY_BUDGET)}원)
                  </label>
                  <input value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" css={inputStyle} />
                </div>
              </>
            )}

            {validationError && <p css={{ fontSize: 12.5, color: "var(--color-red-500)" }}>{validationError}</p>}
            {error && <p css={{ fontSize: 12.5, color: "var(--color-red-500)" }}>{error}</p>}

            <Button disabled={!!validationError || saving} onClick={handleCreate} css={{ alignSelf: "flex-start" }}>
              {saving ? "만드는 중..." : "캠페인 만들기"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
