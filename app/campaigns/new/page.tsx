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
  HiOutlineMegaphone,
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
  HiOutlineMagnifyingGlass,
  HiOutlineUserGroup,
  HiOutlinePhoto,
  HiOutlinePlay,
  HiOutlineArrowUpCircle,
  HiOutlineMinusCircle,
  HiOutlineArrowDownCircle,
  HiOutlineIdentification,
  HiOutlineUser,
  HiOutlineUsers,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OptionCard, OptionGrid } from "@/components/campaigns/OptionCard";
import { WizardProgressBar } from "@/components/campaigns/WizardProgressBar";
import { KeywordAssistant } from "@/components/campaigns/KeywordAssistant";
import { addCampaign } from "@/lib/mock/store";
import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import { recommendAgeRanges } from "@/lib/ai/keywordHeuristics";
import { formatKRW } from "@/lib/format";
import type { Campaign, CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

type Step = "objective" | "industry" | "channel" | "name" | "budget" | "ranking" | "keywords" | "age" | "gender" | "review";

const STEP_ORDER: Step[] = ["objective", "industry", "channel", "name", "budget", "ranking", "keywords", "age", "gender", "review"];

const STEP_LABEL: Record<Step, string> = {
  objective: "목표 선택",
  industry: "업종 선택",
  channel: "채널 선택",
  name: "캠페인 이름",
  budget: "예산 설정",
  ranking: "노출 순위",
  keywords: "키워드",
  age: "타겟 연령대",
  gender: "타겟 성별",
  review: "최종 확인",
};

const OBJECTIVES: { key: CampaignObjective; desc: string; icon: IconType; bg: string; color: string }[] = [
  { key: "conversion", desc: "구매·가입 등 전환을 늘려요", icon: HiOutlineShoppingCart, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { key: "traffic", desc: "사이트 방문을 늘려요", icon: HiOutlineArrowTrendingUp, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  { key: "awareness", desc: "브랜드를 더 많이 알려요", icon: HiOutlineMegaphone, bg: "var(--color-violet-50)", color: "var(--color-violet-600)" },
  { key: "leads", desc: "상담·문의를 모아요", icon: HiOutlineChatBubbleLeftRight, bg: "var(--color-yellow-50)", color: "var(--color-yellow-600)" },
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

const CHANNELS: { key: CampaignChannel; desc: string; icon: IconType; bg: string; color: string }[] = [
  { key: "search", desc: "검색 결과에 노출돼요", icon: HiOutlineMagnifyingGlass, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { key: "social", desc: "SNS 피드에 노출돼요", icon: HiOutlineUserGroup, bg: "var(--color-violet-50)", color: "var(--color-violet-600)" },
  { key: "display", desc: "다양한 사이트 배너로 노출돼요", icon: HiOutlinePhoto, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
  { key: "video", desc: "영상 콘텐츠 앞뒤로 노출돼요", icon: HiOutlinePlay, bg: "var(--color-red-50)", color: "var(--color-red-500)" },
];

const BUDGET_TIERS: { daily: number; label: string; note: string; icon: IconType; bg: string; color: string; recommended?: boolean }[] = [
  { daily: 30000, label: "적게 사용", note: "노출이 적어서 광고 효과가 약할 수 있어요", icon: HiOutlineArrowTrendingDown, bg: "var(--color-gray-100)", color: "var(--color-gray-600)" },
  { daily: 100000, label: "보통", note: "무난하게 효과를 볼 수 있는 금액이에요", icon: HiOutlineBanknotes, bg: "var(--color-blue-50)", color: "var(--color-blue-600)", recommended: true },
  { daily: 200000, label: "많이 사용", note: "더 많이 노출되지만 비용 부담이 커요", icon: HiOutlineArrowTrendingUp, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
];

const RANKING_TIERS: { position: number; label: string; note: string; icon: IconType; bg: string; color: string; recommended?: boolean }[] = [
  { position: 1, label: "가장 위", note: "가장 눈에 잘 띄지만 비용이 커요", icon: HiOutlineArrowUpCircle, bg: "var(--color-blue-50)", color: "var(--color-blue-600)" },
  { position: 3, label: "중간 정도", note: "적당한 비용으로 무난하게 노출돼요", icon: HiOutlineMinusCircle, bg: "var(--color-gray-100)", color: "var(--color-gray-600)", recommended: true },
  { position: 5, label: "저렴하게", note: "비용은 적지만 노출이 줄어요", icon: HiOutlineArrowDownCircle, bg: "var(--color-green-50)", color: "var(--color-green-600)" },
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
  const [objective, setObjective] = useState<CampaignObjective | null>(null);
  const [industry, setIndustry] = useState<CampaignIndustry | null>(null);
  const [channels, setChannels] = useState<CampaignChannel[]>([]);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordBids, setKeywordBids] = useState<Record<string, number>>({});
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [targetPosition, setTargetPosition] = useState<number | null>(null);
  const [age, setAge] = useState<string[]>([]);
  const [gender, setGender] = useState<"all" | "male" | "female" | null>(null);

  const suggestedName = useMemo(() => {
    if (!objective || !industry || channels.length === 0) return "";
    return `${INDUSTRY_LABEL[industry]} ${OBJECTIVE_LABEL[objective]} · ${channels.map((c) => CHANNEL_LABEL[c]).join("/")} 캠페인`;
  }, [objective, industry, channels]);

  // 선택한 키워드에서 연령대를 암시하는 표현을 찾아 추천 태그로 보여준다. 키워드에 신호가 없으면 업종 기준으로 폴백한다.
  const recommendedAges = useMemo(() => {
    if (!industry) return [];
    return recommendAgeRanges(keywords, industry);
  }, [keywords, industry]);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goBack() {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1]);
  }

  async function createCampaign() {
    if (!objective || !industry || channels.length === 0 || !budget || age.length === 0 || !gender) return;
    const campaign: Campaign = {
      id: nextId(),
      name: name.trim() || suggestedName,
      channels,
      objective,
      industry,
      status: "active",
      dailyBudget: budget,
      targeting: {
        ageRange: age.join(", "),
        gender,
        regions: ["전국"],
        interests: [],
        keywords,
        keywordBids: Object.keys(keywordBids).length > 0 ? keywordBids : undefined,
      },
      history: [],
    };
    await addCampaign(campaign);
    router.push(`/campaigns/${campaign.id}`);
  }

  return (
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
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                어떤 업종이에요? 업종에 맞는 키워드를 추천해드리려고요.
              </h2>
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
                      setStep("channel");
                    }}
                  />
                ))}
              </OptionGrid>
            </>
          )}

          {step === "channel" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                어떤 채널에 노출할까요? 여러 개를 함께 골라도 좋아요.
              </h2>
              <OptionGrid columns={2}>
                {CHANNELS.map((c) => (
                  <OptionCard
                    key={c.key}
                    icon={c.icon}
                    iconBg={c.bg}
                    iconColor={c.color}
                    label={CHANNEL_LABEL[c.key]}
                    desc={c.desc}
                    active={channels.includes(c.key)}
                    onClick={() =>
                      setChannels((prev) => (prev.includes(c.key) ? prev.filter((x) => x !== c.key) : [...prev, c.key]))
                    }
                  />
                ))}
              </OptionGrid>
              <Button size="lg" disabled={channels.length === 0} onClick={() => setStep("name")} css={{ alignSelf: "flex-start" }}>
                다음
              </Button>
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
                      setStep("ranking");
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
                      setStep("ranking");
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

          {step === "ranking" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                광고가 검색했을 때 어느 정도 위치에 뜨면 좋을까요?
              </h2>
              <OptionGrid columns={3}>
                {RANKING_TIERS.map((tier) => (
                  <OptionCard
                    key={tier.position}
                    icon={tier.icon}
                    iconBg={tier.bg}
                    iconColor={tier.color}
                    label={tier.label}
                    desc={tier.note}
                    badge={tier.recommended ? "추천" : undefined}
                    active={targetPosition === tier.position}
                    onClick={() => {
                      setTargetPosition(tier.position);
                      setStep("keywords");
                    }}
                  />
                ))}
              </OptionGrid>
            </>
          )}

          {step === "keywords" && objective && industry && budget !== null && targetPosition !== null && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                예산과 순위에 맞춰 키워드를 골라볼게요. 핵심 키워드를 알려주시면 AI가 자동으로 담아드려요.
              </h2>
              <KeywordAssistant
                objective={objective}
                channels={channels}
                industry={industry}
                name={name.trim()}
                selected={keywords}
                onChange={setKeywords}
                onBidsChange={setKeywordBids}
                dailyBudget={budget}
                targetPosition={targetPosition}
                onConfirm={() => setStep("age")}
              />
            </>
          )}

          {step === "age" && (
            <>
              <h2 css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>
                주요 타겟 연령대는요? 여러 개 골라도 좋아요.
              </h2>
              {recommendedAges.length > 0 && (
                <p css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>
                  선택한 키워드를 분석해서 <span css={{ fontWeight: 600, color: "var(--color-blue-600)" }}>추천</span> 연령대를
                  표시했어요.
                </p>
              )}
              <OptionGrid columns={3}>
                {AGE_PRESETS.map((a) => (
                  <OptionCard
                    key={a}
                    icon={HiOutlineIdentification}
                    iconBg="var(--color-blue-50)"
                    iconColor="var(--color-blue-600)"
                    label={a}
                    badge={recommendedAges.includes(a) ? "추천" : undefined}
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
            {channels.map((c) => (
              <Badge key={c} tone="gray">
                {CHANNEL_LABEL[c]}
              </Badge>
            ))}
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
          {keywords.length > 0 && (
            <div css={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {keywords.map((k) => (
                <Badge key={k} tone="blue">
                  {k}
                </Badge>
              ))}
            </div>
          )}
          <Button css={{ marginTop: "1rem", width: "100%" }} disabled={step !== "review"} onClick={createCampaign}>
            캠페인 만들기
          </Button>
        </Card>
      </div>
    </div>
  );
}
