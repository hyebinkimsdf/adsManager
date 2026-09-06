/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/assistant/ChatBubble";
import { KeywordAssistant } from "@/components/campaigns/KeywordAssistant";
import { addCampaign } from "@/lib/mock/store";
import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import { formatKRW } from "@/lib/format";
import type { Campaign, CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

type Step = "objective" | "industry" | "channel" | "name" | "budget" | "ranking" | "keywords" | "age" | "gender" | "review";

const OBJECTIVES: { key: CampaignObjective; desc: string }[] = [
  { key: "conversion", desc: "구매·가입 등 전환을 늘려요" },
  { key: "traffic", desc: "사이트 방문을 늘려요" },
  { key: "awareness", desc: "브랜드를 더 많이 알려요" },
  { key: "leads", desc: "상담·문의를 모아요" },
];

const INDUSTRIES: { key: CampaignIndustry; desc: string }[] = [
  { key: "food", desc: "카페·식당·베이커리 등" },
  { key: "beauty", desc: "뷰티·헤어·피부관리 등" },
  { key: "education", desc: "학원·과외·클래스 등" },
  { key: "medical", desc: "병원·의원·클리닉 등" },
  { key: "shopping", desc: "온라인몰·쇼핑몰 등" },
  { key: "realestate", desc: "분양·중개·임대 등" },
  { key: "finance", desc: "대출·보험·재테크 등" },
  { key: "it_app", desc: "앱·SaaS·플랫폼 등" },
  { key: "etc", desc: "위 업종에 해당하지 않아요" },
];

const CHANNELS: { key: CampaignChannel; desc: string }[] = [
  { key: "search", desc: "검색 결과에 노출돼요" },
  { key: "social", desc: "SNS 피드에 노출돼요" },
  { key: "display", desc: "다양한 사이트 배너로 노출돼요" },
  { key: "video", desc: "영상 콘텐츠 앞뒤로 노출돼요" },
];

const BUDGET_TIERS: { daily: number; label: string; note: string; recommended?: boolean }[] = [
  { daily: 30000, label: "적게 사용", note: "노출이 적어서 광고 효과가 약할 수 있어요" },
  { daily: 100000, label: "보통", note: "무난하게 효과를 볼 수 있는 금액이에요", recommended: true },
  { daily: 200000, label: "많이 사용", note: "더 많이 노출되지만 비용 부담이 커요" },
];

const RANKING_TIERS: { position: number; label: string; note: string; recommended?: boolean }[] = [
  { position: 1, label: "가장 위", note: "가장 눈에 잘 띄지만 비용이 커요" },
  { position: 3, label: "중간 정도", note: "적당한 비용으로 무난하게 노출돼요", recommended: true },
  { position: 5, label: "저렴하게", note: "비용은 적지만 노출이 줄어요" },
];

const AGE_PRESETS = ["10대", "20대", "30대", "40대", "50대 이상", "전체"];

const inputStyle = css`
  flex: 1;
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

const tierButtonStyle = css`
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
`;

function nextId() {
  return `camp-custom-${Date.now()}`;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("objective");
  const [objective, setObjective] = useState<CampaignObjective | null>(null);
  const [industry, setIndustry] = useState<CampaignIndustry | null>(null);
  const [channels, setChannels] = useState<CampaignChannel[]>([]);
  const [channelsConfirmed, setChannelsConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsConfirmed, setKeywordsConfirmed] = useState(false);
  const [keywordBids, setKeywordBids] = useState<Record<string, number>>({});
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [targetPosition, setTargetPosition] = useState<number | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "male" | "female" | null>(null);

  const suggestedName = useMemo(() => {
    if (!objective || !industry || channels.length === 0) return "";
    return `${INDUSTRY_LABEL[industry]} ${OBJECTIVE_LABEL[objective]} · ${channels.map((c) => CHANNEL_LABEL[c]).join("/")} 캠페인`;
  }, [objective, industry, channels]);

  async function createCampaign() {
    if (!objective || !industry || channels.length === 0 || !budget || !age || !gender) return;
    const campaign: Campaign = {
      id: nextId(),
      name: name.trim() || suggestedName,
      channels,
      objective,
      industry,
      status: "active",
      dailyBudget: budget,
      targeting: {
        ageRange: age,
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
      <Card css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>새 캠페인 만들기</h1>
          <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
            몇 가지만 답하면 바로 만들어드려요. 오른쪽에서 실시간으로 확인하세요.
          </p>
        </div>

        <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <ChatBubble role="assistant">어떤 목표로 캠페인을 만들까요?</ChatBubble>
          {step === "objective" ? (
            <ChipGroup
              items={OBJECTIVES.map((o) => ({ key: o.key, label: OBJECTIVE_LABEL[o.key], desc: o.desc }))}
              onSelect={(key) => {
                setObjective(key as CampaignObjective);
                setStep("industry");
              }}
            />
          ) : (
            objective && (
              <ChatBubble role="user" onClick={() => setStep("objective")}>
                {OBJECTIVE_LABEL[objective]}
              </ChatBubble>
            )
          )}

          {objective && (
            <>
              <ChatBubble role="assistant">
                어떤 업종이에요? 업종에 맞는 키워드를 추천해드리려고요.
              </ChatBubble>
              {step === "industry" ? (
                <ChipGroup
                  items={INDUSTRIES.map((i) => ({ key: i.key, label: INDUSTRY_LABEL[i.key], desc: i.desc }))}
                  onSelect={(key) => {
                    setIndustry(key as CampaignIndustry);
                    setStep("channel");
                  }}
                />
              ) : (
                industry && (
                  <ChatBubble role="user" onClick={() => setStep("industry")}>
                    {INDUSTRY_LABEL[industry]}
                  </ChatBubble>
                )
              )}
            </>
          )}

          {industry && (
            <>
              <ChatBubble role="assistant">어떤 채널에 노출할까요? 여러 개를 함께 골라도 좋아요.</ChatBubble>
              {step === "channel" ? (
                <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <MultiChipGroup
                    items={CHANNELS.map((c) => ({ key: c.key, label: CHANNEL_LABEL[c.key], desc: c.desc }))}
                    selected={channels}
                    onToggle={(key) => {
                      const ch = key as CampaignChannel;
                      setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
                    }}
                  />
                  <Button
                    size="md"
                    disabled={channels.length === 0}
                    onClick={() => {
                      setChannelsConfirmed(true);
                      setStep("name");
                    }}
                    css={{ alignSelf: "flex-start" }}
                  >
                    다음
                  </Button>
                </div>
              ) : (
                channelsConfirmed && (
                  <ChatBubble role="user" onClick={() => setStep("channel")}>
                    {channels.map((c) => CHANNEL_LABEL[c]).join(", ")}
                  </ChatBubble>
                )
              )}
            </>
          )}

          {channelsConfirmed && (
            <>
              <ChatBubble role="assistant">캠페인 이름을 정해주세요. (비워두면 자동으로 지어드려요)</ChatBubble>
              {step === "name" ? (
                <div css={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={suggestedName}
                    css={inputStyle}
                  />
                  <Button size="md" onClick={() => setStep("budget")}>
                    다음
                  </Button>
                </div>
              ) : (
                <ChatBubble role="user" onClick={() => setStep("name")}>
                  {name.trim() || suggestedName}
                </ChatBubble>
              )}
            </>
          )}

          {channelsConfirmed && (["budget", "ranking", "keywords", "age", "gender", "review"].includes(step) || budget !== null) && (
            <>
              <ChatBubble role="assistant">
                한 달에 광고비를 얼마 정도 쓸 수 있을까요? 하루 기준 금액으로 나눠서 집행돼요.
              </ChatBubble>
              {step === "budget" ? (
                <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {BUDGET_TIERS.map((tier) => (
                      <button
                        key={tier.daily}
                        type="button"
                        onClick={() => {
                          setBudget(tier.daily);
                          setStep("ranking");
                        }}
                        css={tierButtonStyle}
                      >
                        <span css={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                          {tier.label}
                          {tier.recommended && <Badge tone="blue">추천</Badge>}
                        </span>
                        <span css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
                          하루 {formatKRW(tier.daily)}원 · 월 약 {formatKRW(tier.daily * 30)}원
                        </span>
                        <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{tier.note}</span>
                      </button>
                    ))}
                  </div>
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
                        size="md"
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
                </div>
              ) : (
                budget !== null && (
                  <ChatBubble role="user" onClick={() => setStep("budget")}>
                    하루 {formatKRW(budget)}원 (월 약 {formatKRW(budget * 30)}원)
                  </ChatBubble>
                )
              )}
            </>
          )}

          {budget !== null && (["ranking", "keywords", "age", "gender", "review"].includes(step) || targetPosition !== null) && (
            <>
              <ChatBubble role="assistant">광고가 검색했을 때 어느 정도 위치에 뜨면 좋을까요?</ChatBubble>
              {step === "ranking" ? (
                <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {RANKING_TIERS.map((tier) => (
                    <button
                      key={tier.position}
                      type="button"
                      onClick={() => {
                        setTargetPosition(tier.position);
                        setStep("keywords");
                      }}
                      css={tierButtonStyle}
                    >
                      <span css={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                        {tier.label}
                        {tier.recommended && <Badge tone="blue">추천</Badge>}
                      </span>
                      <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{tier.note}</span>
                    </button>
                  ))}
                </div>
              ) : (
                targetPosition !== null && (
                  <ChatBubble role="user" onClick={() => setStep("ranking")}>
                    {RANKING_TIERS.find((t) => t.position === targetPosition)?.label}
                  </ChatBubble>
                )
              )}
            </>
          )}

          {budget !== null &&
            targetPosition !== null &&
            (["keywords", "age", "gender", "review"].includes(step) || keywordsConfirmed) && (
              <>
                <ChatBubble role="assistant">
                  예산과 순위에 맞춰 키워드를 골라볼게요. 핵심 키워드를 알려주시면 AI가 자동으로 담아드려요.
                </ChatBubble>
                {step === "keywords" ? (
                  <KeywordAssistant
                    objective={objective!}
                    channels={channels}
                    industry={industry!}
                    name={name.trim()}
                    selected={keywords}
                    onChange={setKeywords}
                    onBidsChange={setKeywordBids}
                    dailyBudget={budget}
                    targetPosition={targetPosition}
                    onConfirm={() => {
                      setKeywordsConfirmed(true);
                      setStep("age");
                    }}
                  />
                ) : (
                  keywordsConfirmed && (
                    <ChatBubble role="user" onClick={() => setStep("keywords")}>
                      {keywords.length > 0 ? keywords.join(", ") : "키워드 없이 진행할게요"}
                    </ChatBubble>
                  )
                )}
              </>
            )}

          {keywordsConfirmed && (
            <>
              <ChatBubble role="assistant">주요 타겟 연령대는요?</ChatBubble>
              {step === "age" ? (
                <ChipGroup
                  items={AGE_PRESETS.map((a) => ({ key: a, label: a }))}
                  onSelect={(key) => {
                    setAge(key);
                    setStep("gender");
                  }}
                />
              ) : (
                age && (
                  <ChatBubble role="user" onClick={() => setStep("age")}>
                    {age}
                  </ChatBubble>
                )
              )}
            </>
          )}

          {age && (
            <>
              <ChatBubble role="assistant">성별도 좁혀볼까요?</ChatBubble>
              {step === "gender" ? (
                <ChipGroup
                  items={[
                    { key: "all", label: "전체" },
                    { key: "female", label: "여성" },
                    { key: "male", label: "남성" },
                  ]}
                  onSelect={(key) => {
                    setGender(key as "all" | "male" | "female");
                    setStep("review");
                  }}
                />
              ) : (
                gender && (
                  <ChatBubble role="user" onClick={() => setStep("gender")}>
                    {gender === "all" ? "전체" : gender === "male" ? "남성" : "여성"}
                  </ChatBubble>
                )
              )}
            </>
          )}

          {step === "review" && (
            <ChatBubble role="assistant">준비됐어요! 오른쪽 미리보기를 확인하고 만들어보세요.</ChatBubble>
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
            {age && <Badge tone="gray">{age}</Badge>}
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

function ChipGroup({
  items,
  onSelect,
}: {
  items: { key: string; label: string; desc?: string }[];
  onSelect: (key: string) => void;
}) {
  return (
    <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {items.map((item) => (
        <button key={item.key} type="button" onClick={() => onSelect(item.key)} css={tierButtonStyle}>
          <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{item.label}</span>
          {item.desc && <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{item.desc}</span>}
        </button>
      ))}
    </div>
  );
}

function MultiChipGroup({
  items,
  selected,
  onToggle,
}: {
  items: { key: string; label: string; desc?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {items.map((item) => {
        const active = selected.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={active}
            css={css`
              display: flex;
              flex-direction: column;
              border-radius: var(--radius-md);
              border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
              background-color: ${active ? "var(--color-blue-50)" : "transparent"};
              padding: 0.625rem 0.875rem;
              text-align: left;
              transition: border-color 150ms, background-color 150ms;

              ${!active &&
              `
                &:hover {
                  border-color: var(--color-blue-500);
                  background-color: var(--color-blue-50);
                }
              `}
            `}
          >
            <span
              css={{
                fontSize: 13,
                fontWeight: 600,
                color: active ? "var(--color-blue-600)" : "var(--color-gray-900)",
              }}
            >
              {item.label}
            </span>
            {item.desc && <span css={{ fontSize: 11, color: "var(--color-gray-500)" }}>{item.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}
