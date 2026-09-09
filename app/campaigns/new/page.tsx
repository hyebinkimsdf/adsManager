/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineArrowLeft,
  HiOutlineShoppingCart,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCake,
  HiOutlineSparkles,
  HiOutlineAcademicCap,
  HiOutlineHeart,
  HiOutlineShoppingBag,
  HiOutlineHome,
  HiOutlineBanknotes,
  HiOutlineDevicePhoneMobile,
  HiOutlineEllipsisHorizontalCircle,
  HiOutlineIdentification,
  HiOutlineUser,
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiSparkles,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OptionCard, OptionGrid } from "@/components/campaigns/OptionCard";
import { WizardProgressBar } from "@/components/campaigns/WizardProgressBar";
import { EngineBadge } from "@/components/dashboard/EngineBadge";
import { addCampaign } from "@/lib/mock/store";
import { INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import { useCampaignDraft } from "@/lib/ai/useCampaignDraft";
import { formatKRW } from "@/lib/format";
import type { Campaign, CampaignIndustry, DisplayObjective } from "@/lib/mock/types";
import type { CampaignDraftResult } from "@/lib/ai/useCampaignDraft";

type Step = "objective" | "industry" | "name" | "budget" | "age" | "gender" | "review";

const STEP_ORDER: Step[] = ["objective", "industry", "name", "budget", "age", "gender", "review"];

const STEP_LABEL: Record<Step, string> = {
  objective: "목표 선택",
  industry: "업종 선택",
  name: "캠페인 이름",
  budget: "예산 설정",
  age: "타겟 연령대",
  gender: "타겟 성별",
  review: "최종 확인",
};

const OBJECTIVES: { key: DisplayObjective; desc: string; icon: IconType; bg: string; color: string }[] = [
  { key: "purchase", desc: "구매·주문을 늘려요", icon: HiOutlineShoppingCart, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { key: "app_install", desc: "앱 설치를 늘려요", icon: HiOutlineDevicePhoneMobile, bg: "var(--color-violet-50)", color: "var(--color-violet-600)" },
  { key: "leads", desc: "상담·문의를 모아요", icon: HiOutlineChatBubbleLeftRight, bg: "var(--color-yellow-50)", color: "var(--color-yellow-600)" },
  { key: "visit", desc: "사이트 방문을 늘려요", icon: HiOutlineArrowTrendingUp, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
];

const INDUSTRIES: { key: CampaignIndustry; desc: string; icon: IconType; bg: string; color: string }[] = [
  { key: "food", desc: "카페·식당·베이커리 등", icon: HiOutlineCake, bg: "var(--color-yellow-50)", color: "var(--color-yellow-600)" },
  { key: "beauty", desc: "뷰티·헤어·피부관리 등", icon: HiOutlineSparkles, bg: "var(--color-violet-50)", color: "var(--color-violet-600)" },
  { key: "education", desc: "학원·과외·클래스 등", icon: HiOutlineAcademicCap, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { key: "medical", desc: "병원·의원·클리닉 등", icon: HiOutlineHeart, bg: "var(--color-red-50)", color: "var(--color-red-500)" },
  { key: "shopping", desc: "온라인몰·쇼핑몰 등", icon: HiOutlineShoppingBag, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  { key: "realestate", desc: "분양·중개·임대 등", icon: HiOutlineHome, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { key: "finance", desc: "대출·보험·재테크 등", icon: HiOutlineBanknotes, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  { key: "it_app", desc: "앱·SaaS·플랫폼 등", icon: HiOutlineDevicePhoneMobile, bg: "var(--color-violet-50)", color: "var(--color-violet-600)" },
  { key: "etc", desc: "위 업종에 해당하지 않아요", icon: HiOutlineEllipsisHorizontalCircle, bg: "var(--color-gray-100)", color: "var(--color-gray-600)" },
];

const BUDGET_TIERS: { daily: number; label: string; note: string; icon: IconType; bg: string; color: string; recommended?: boolean }[] = [
  { daily: 30000, label: "적게 사용", note: "노출이 적어서 광고 효과가 약할 수 있어요", icon: HiOutlineArrowTrendingDown, bg: "var(--color-gray-100)", color: "var(--color-gray-600)" },
  { daily: 100000, label: "보통", note: "무난하게 효과를 볼 수 있는 금액이에요", icon: HiOutlineBanknotes, bg: "var(--color-blue-50)", color: "var(--color-blue-600)", recommended: true },
  { daily: 200000, label: "많이 사용", note: "더 많이 노출되지만 비용 부담이 커요", icon: HiOutlineArrowTrendingUp, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
];

const AGE_PRESETS = ["10대", "20대", "30대", "40대", "50대 이상", "전체"];

const GENDER_OPTIONS: { key: "all" | "male" | "female"; label: string; icon: IconType }[] = [
  { key: "all", label: "전체", icon: HiOutlineUsers },
  { key: "female", label: "여성", icon: HiOutlineUser },
  { key: "male", label: "남성", icon: HiOutlineUser },
];

const inputStyle = css`
  flex: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--color-gray-50);
  padding: 0.75rem 0.875rem;
  font-size: 15px;
  outline: none;

  &:focus {
    border-color: var(--color-blue-500);
  }
`;

function nextId() {
  return `camp-custom-${Date.now()}`;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      css={css`
        display: flex;
        width: fit-content;
        align-items: center;
        gap: 0.25rem;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-500);

        &:hover {
          color: var(--color-gray-700);
        }
      `}
    >
      <HiOutlineArrowLeft style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
      이전
    </button>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("objective");
  const [objective, setObjective] = useState<DisplayObjective | null>(null);
  const [industry, setIndustry] = useState<CampaignIndustry | null>(null);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [age, setAge] = useState<string[]>([]);
  const [gender, setGender] = useState<"all" | "male" | "female" | null>(null);

  const suggestedName = useMemo(() => {
    if (!objective || !industry) return "";
    return `${INDUSTRY_LABEL[industry]} ${OBJECTIVE_LABEL[objective]} 캠페인`;
  }, [objective, industry]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const { generate: generateDraft } = useCampaignDraft();
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<CampaignDraftResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCreating, setAiCreating] = useState(false);

  async function handleAiGenerate() {
    if (!aiDescription.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await generateDraft(aiDescription.trim());
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "초안 생성에 실패했어요.");
    } finally {
      setAiLoading(false);
    }
  }

  // AI 초안을 그대로 캠페인으로 만든다 — 위저드를 거치지 않는 원클릭 경로. 타겟팅은 AI가 정하지 않는
  // 값이라 가장 넓은 기본값(전체 연령·성별)으로 시작하고, 세부 조정은 캠페인 상세에서 이어서 한다.
  async function handleAiCreateNow() {
    if (!aiResult) return;
    setAiCreating(true);
    try {
      const { draft } = aiResult;
      const campaign: Campaign = {
        id: nextId(),
        name: draft.name.trim() || `${INDUSTRY_LABEL[draft.industry]} ${OBJECTIVE_LABEL[draft.objective]} 캠페인`,
        adType: "display",
        objective: draft.objective,
        industry: draft.industry,
        status: "active",
        dailyBudget: draft.dailyBudget,
        targeting: { ageRange: "전체", gender: "all", regions: ["전국"], interests: [] },
        history: [],
      };
      await addCampaign(campaign);
      router.push(`/campaigns/${campaign.id}`);
    } finally {
      setAiCreating(false);
    }
  }

  // 타겟팅(연령·성별)까지 직접 정하고 싶을 때 — AI 초안 값을 위저드에 채워 넣고 "타겟 연령대" 단계부터 이어간다.
  function handleAiRefine() {
    if (!aiResult) return;
    const { draft } = aiResult;
    setObjective(draft.objective);
    setIndustry(draft.industry);
    setName(draft.name);
    setBudget(draft.dailyBudget);
    setStep("age");
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1]);
  }

  async function createCampaign() {
    if (!objective || !industry || !budget || age.length === 0 || !gender) return;
    const campaign: Campaign = {
      id: nextId(),
      name: name.trim() || suggestedName,
      adType: "display",
      objective,
      industry,
      status: "active",
      dailyBudget: budget,
      targeting: {
        ageRange: age.join(", "),
        gender,
        regions: ["전국"],
        interests: [],
      },
      history: [],
    };
    await addCampaign(campaign);
    router.push(`/campaigns/${campaign.id}`);
  }

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            css={{
              display: "flex",
              height: "1.75rem",
              width: "1.75rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              backgroundColor: "var(--color-blue-50)",
            }}
          >
            <HiSparkles style={{ height: "0.875rem", width: "0.875rem", color: "var(--color-blue-500)" }} aria-hidden="true" />
          </span>
          <h2 css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>AI로 한 번에 만들기</h2>
        </div>
        <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>
          어떤 광고를 만들고 싶은지 설명해주세요. 목표·업종·예산을 대신 정해서 바로 만들어드려요.
        </p>
        <div css={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            placeholder="예: 온라인 쇼핑몰 매출을 늘리고 싶어요, 하루 10만원 정도 쓸 수 있어요"
            css={inputStyle}
          />
          <Button size="lg" disabled={!aiDescription.trim() || aiLoading} onClick={handleAiGenerate}>
            {aiLoading ? "생각하는 중..." : "AI로 초안 만들기"}
          </Button>
        </div>
        {aiError && <p css={{ fontSize: 12.5, color: "var(--color-red-500)" }}>{aiError}</p>}

        {aiResult && (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              border-radius: var(--radius-md);
              border: 1px solid var(--color-blue-100, var(--border-subtle));
              background-color: var(--color-blue-50);
              padding: 1rem;
            `}
          >
            <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <Badge tone="blue">{OBJECTIVE_LABEL[aiResult.draft.objective]}</Badge>
                <Badge tone="gray">{INDUSTRY_LABEL[aiResult.draft.industry]}</Badge>
                <Badge tone="gray">일 {formatKRW(aiResult.draft.dailyBudget)}원</Badge>
              </div>
              <EngineBadge engine={aiResult.engine} />
            </div>
            <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{aiResult.draft.name}</p>
            <p css={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>{aiResult.draft.reasoning}</p>
            <div css={{ display: "flex", gap: "0.5rem" }}>
              <Button disabled={aiCreating} onClick={handleAiCreateNow}>
                {aiCreating ? (
                  "만드는 중..."
                ) : (
                  <>
                    <HiOutlineCheckCircle style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 이 설정으로 캠페인 만들기
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={handleAiRefine}>
                <HiOutlinePencilSquare style={{ height: "1rem", width: "1rem" }} aria-hidden="true" /> 직접 조정하기
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          @media (min-width: 1024px) {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            align-items: flex-start;
            gap: 1.5rem;
          }
        `}
      >
      <Card css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>새 캠페인 만들기</h1>
          <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
            몇 가지만 답하면 바로 만들어드려요. 오른쪽에서 실시간으로 확인하세요.
          </p>
        </div>

        <WizardProgressBar index={stepIndex} total={STEP_ORDER.length} label={STEP_LABEL[step]} />

        <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {stepIndex > 0 && <BackButton onClick={goBack} />}

          {step === "objective" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>어떤 목표로 캠페인을 만들까요?</h2>
              <OptionGrid columns={2}>
                {OBJECTIVES.map((o) => (
                  <OptionCard
                    key={o.key}
                    icon={o.icon}
                    iconBg={o.bg}
                    iconColor={o.color}
                    label={OBJECTIVE_LABEL[o.key]}
                    desc={o.desc}
                    active={objective === o.key}
                    onClick={() => {
                      setObjective(o.key);
                      setStep("industry");
                    }}
                  />
                ))}
              </OptionGrid>
            </>
          )}

          {step === "industry" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>어떤 업종이에요?</h2>
              <OptionGrid columns={3}>
                {INDUSTRIES.map((i) => (
                  <OptionCard
                    key={i.key}
                    icon={i.icon}
                    iconBg={i.bg}
                    iconColor={i.color}
                    label={INDUSTRY_LABEL[i.key]}
                    desc={i.desc}
                    active={industry === i.key}
                    onClick={() => {
                      setIndustry(i.key);
                      setStep("name");
                    }}
                  />
                ))}
              </OptionGrid>
            </>
          )}

          {step === "name" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                캠페인 이름을 정해주세요. (비워두면 자동으로 지어드려요)
              </h2>
              <div css={{ display: "flex", gap: "0.5rem" }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestedName} css={inputStyle} />
                <Button size="lg" onClick={() => setStep("budget")}>
                  다음
                </Button>
              </div>
            </>
          )}

          {step === "budget" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                한 달에 광고비를 얼마 정도 쓸 수 있을까요? 하루 기준 금액으로 나눠서 집행돼요.
              </h2>
              <OptionGrid columns={3}>
                {BUDGET_TIERS.map((tier) => (
                  <OptionCard
                    key={tier.daily}
                    icon={tier.icon}
                    iconBg={tier.bg}
                    iconColor={tier.color}
                    label={tier.label}
                    badge={tier.recommended ? "추천" : undefined}
                    active={budget === tier.daily}
                    desc={
                      <>
                        하루 {formatKRW(tier.daily)}원 · 월 약 {formatKRW(tier.daily * 30)}원
                        <br />
                        {tier.note}
                      </>
                    }
                    onClick={() => {
                      setBudget(tier.daily);
                      setStep("age");
                    }}
                  />
                ))}
              </OptionGrid>
              <div css={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div css={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={budgetDraft}
                    onChange={(e) => setBudgetDraft(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="하루 예산 직접 입력"
                    inputMode="numeric"
                    css={inputStyle}
                  />
                  <Button
                    size="lg"
                    variant="secondary"
                    disabled={!budgetDraft}
                    onClick={() => {
                      setBudget(Number(budgetDraft));
                      setStep("age");
                    }}
                  >
                    확인
                  </Button>
                </div>
                {budgetDraft && (
                  <span css={{ fontSize: 11, color: "var(--color-gray-400)" }}>
                    월 약 {formatKRW(Number(budgetDraft) * 30)}원 정도예요
                  </span>
                )}
              </div>
            </>
          )}

          {step === "age" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                주요 타겟 연령대는요? 여러 개 골라도 좋아요.
              </h2>
              <OptionGrid columns={3}>
                {AGE_PRESETS.map((a) => (
                  <OptionCard
                    key={a}
                    icon={HiOutlineIdentification}
                    iconBg="var(--color-blue-50)"
                    iconColor="var(--color-blue-600)"
                    label={a}
                    active={age.includes(a)}
                    onClick={() => setAge((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))}
                  />
                ))}
              </OptionGrid>
              <Button size="lg" disabled={age.length === 0} onClick={() => setStep("gender")} css={{ alignSelf: "flex-start" }}>
                다음
              </Button>
            </>
          )}

          {step === "gender" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>성별도 좁혀볼까요?</h2>
              <OptionGrid columns={3}>
                {GENDER_OPTIONS.map((g) => (
                  <OptionCard
                    key={g.key}
                    icon={g.icon}
                    iconBg="var(--color-violet-50)"
                    iconColor="var(--color-violet-600)"
                    label={g.label}
                    active={gender === g.key}
                    onClick={() => {
                      setGender(g.key);
                      setStep("review");
                    }}
                  />
                ))}
              </OptionGrid>
            </>
          )}

          {step === "review" && (
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.75rem;
                border-radius: var(--radius-lg);
                background-color: var(--color-green-50);
                padding: 2rem 1.5rem;
                text-align: center;
              `}
            >
              <HiOutlineCheckCircle style={{ height: "2.5rem", width: "2.5rem", color: "var(--color-green-600)" }} aria-hidden="true" />
              <p css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>모든 준비가 끝났어요!</p>
              <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>오른쪽 미리보기를 확인하고 캠페인을 만들어보세요.</p>
            </div>
          )}
        </div>
      </Card>

      <div css={css`@media (min-width: 1024px) { position: sticky; top: 1.5rem; }`}>
        <Card>
          <p css={{ marginBottom: "0.75rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-500)" }}>미리보기</p>
          <p css={{ marginBottom: "0.75rem", fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
            {name.trim() || suggestedName || "새 캠페인"}
          </p>
          <div css={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {industry && <Badge tone="gray">{INDUSTRY_LABEL[industry]}</Badge>}
            {objective && <Badge tone="blue">{OBJECTIVE_LABEL[objective]}</Badge>}
            {age.map((a) => (
              <Badge key={a} tone="gray">
                {a}
              </Badge>
            ))}
            {gender && <Badge tone="gray">{gender === "all" ? "전체 성별" : gender === "male" ? "남성" : "여성"}</Badge>}
          </div>
          <div css={css`border-radius: var(--radius-sm); background-color: var(--color-gray-50); padding: 0.875rem;`}>
            <p css={{ fontSize: 12, color: "var(--color-gray-500)" }}>일 예산</p>
            <p css={{ fontSize: 20, fontWeight: 700, color: "var(--color-gray-900)" }}>
              {budget ? `${formatKRW(budget)}원` : "-"}
            </p>
          </div>
          <Button css={{ marginTop: "1rem", width: "100%" }} disabled={step !== "review"} onClick={createCampaign}>
            캠페인 만들기
          </Button>
        </Card>
      </div>
      </div>
    </div>
  );
}
