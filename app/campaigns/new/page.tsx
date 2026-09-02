"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ChatBubble } from "@/components/assistant/ChatBubble";
import { KeywordAssistant } from "@/components/campaigns/KeywordAssistant";
import { addCampaign } from "@/lib/mock/store";
import { cn } from "@/lib/cn";
import { CHANNEL_LABEL, INDUSTRY_LABEL, OBJECTIVE_LABEL } from "@/lib/mock/campaigns";
import { formatKRW } from "@/lib/format";
import type { Campaign, CampaignChannel, CampaignIndustry, CampaignObjective } from "@/lib/mock/types";

type Step = "objective" | "industry" | "channel" | "name" | "keywords" | "budget" | "age" | "gender" | "review";

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

const BUDGET_PRESETS = [30000, 50000, 100000, 200000];
const AGE_PRESETS = ["10대", "20대", "30대", "40대", "50대 이상", "전체"];

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
  const [budgetSuggestion, setBudgetSuggestion] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [age, setAge] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "male" | "female" | null>(null);

  const suggestedName = useMemo(() => {
    if (!objective || !industry || channels.length === 0) return "";
    return `${INDUSTRY_LABEL[industry]} ${OBJECTIVE_LABEL[objective]} · ${channels.map((c) => CHANNEL_LABEL[c]).join("/")} 캠페인`;
  }, [objective, industry, channels]);

  function createCampaign() {
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
    addCampaign(campaign);
    router.push(`/campaigns/${campaign.id}`);
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-4">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--color-gray-900)]">새 캠페인 만들기</h1>
          <p className="mt-1 text-[13px] text-[var(--color-gray-500)]">
            몇 가지만 답하면 바로 만들어드려요. 오른쪽에서 실시간으로 확인하세요.
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
                <div className="flex flex-col gap-2">
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
                    className="self-start"
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
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={suggestedName}
                    className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--color-gray-50)] px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-blue-500)]"
                  />
                  <Button size="md" onClick={() => setStep("keywords")}>
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

          {channelsConfirmed && (["keywords", "budget", "age", "gender", "review"].includes(step) || keywordsConfirmed) && (
            <>
              <ChatBubble role="assistant">
                검색될 만한 키워드도 몇 개 정해볼까요? AI 추천을 받아 바로 담을 수 있어요.
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
                  onBudgetEstimate={setBudgetSuggestion}
                  onConfirm={() => {
                    setKeywordsConfirmed(true);
                    setStep("budget");
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

          {channelsConfirmed && keywordsConfirmed && (["budget", "age", "gender", "review"].includes(step) || budget !== null) && (
            <>
              <ChatBubble role="assistant">하루 예산은 얼마로 할까요?</ChatBubble>
              {step === "budget" ? (
                <div className="flex flex-col gap-2">
                  {budgetSuggestion !== null && budgetSuggestion > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBudget(budgetSuggestion);
                        setStep("age");
                      }}
                      className="flex items-center gap-1.5 self-start rounded-[var(--radius-full)] border border-[var(--color-blue-500)] bg-[var(--color-blue-50)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-blue-600)]"
                    >
                      <Badge tone="blue">AI 추천</Badge>
                      선택한 키워드 기준 일 {formatKRW(budgetSuggestion)}원
                    </button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_PRESETS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setBudget(b);
                          setStep("age");
                        }}
                        className="rounded-[var(--radius-full)] border border-[var(--border-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-gray-700)] hover:border-[var(--color-blue-500)] hover:text-[var(--color-blue-600)]"
                      >
                        {formatKRW(b)}원
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="직접 입력"
                      inputMode="numeric"
                      className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--color-gray-50)] px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-blue-500)]"
                    />
                    <Button
                      size="md"
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
                </div>
              ) : (
                budget && (
                  <ChatBubble role="user" onClick={() => setStep("budget")}>
                    {formatKRW(budget)}원
                  </ChatBubble>
                )
              )}
            </>
          )}

          {budget && (
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

      <div className="lg:sticky lg:top-6">
        <Card>
          <p className="mb-3 text-[13px] font-semibold text-[var(--color-gray-500)]">미리보기</p>
          <p className="mb-3 text-[16px] font-bold text-[var(--color-gray-900)]">
            {name.trim() || suggestedName || "새 캠페인"}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
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
          <div className="rounded-[var(--radius-sm)] bg-[var(--color-gray-50)] p-3.5">
            <p className="text-[12px] text-[var(--color-gray-500)]">일 예산</p>
            <p className="text-[20px] font-bold text-[var(--color-gray-900)]">
              {budget ? `${formatKRW(budget)}원` : "-"}
            </p>
          </div>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Badge key={k} tone="blue">
                  {k}
                </Badge>
              ))}
            </div>
          )}
          <Button
            className="mt-4 w-full"
            disabled={step !== "review"}
            onClick={createCampaign}
          >
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
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--color-blue-500)] hover:bg-[var(--color-blue-50)]"
        >
          <span className="text-[13px] font-semibold text-[var(--color-gray-900)]">{item.label}</span>
          {item.desc && <span className="text-[11px] text-[var(--color-gray-500)]">{item.desc}</span>}
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
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selected.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={active}
            className={cn(
              "flex flex-col rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors",
              active
                ? "border-[var(--color-blue-500)] bg-[var(--color-blue-50)]"
                : "border-[var(--border-subtle)] hover:border-[var(--color-blue-500)] hover:bg-[var(--color-blue-50)]"
            )}
          >
            <span
              className={cn(
                "text-[13px] font-semibold",
                active ? "text-[var(--color-blue-600)]" : "text-[var(--color-gray-900)]"
              )}
            >
              {item.label}
            </span>
            {item.desc && <span className="text-[11px] text-[var(--color-gray-500)]">{item.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}
