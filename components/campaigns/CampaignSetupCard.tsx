/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowPath,
  HiOutlineArrowRight,
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineFlag,
  HiOutlineInformationCircle,
  HiOutlineLink,
  HiOutlinePencilSquare,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineSparkles,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OptionCard, OptionGrid } from "@/components/campaigns/OptionCard";
import type { CampaignSetupDraft, CampaignSetupOptions } from "@/lib/campaigns/setup";
import { isSetupDate } from "@/lib/campaigns/setup";
import { describeSetupNextSteps, evaluateSetupChecklist } from "@/lib/campaigns/setupChecklist";
import { applySetupTemplate, describeSetupTemplate, SETUP_TEMPLATES, type SetupTemplateId } from "@/lib/campaigns/setupTemplates";
import { formatKRW } from "@/lib/format";
import type { Campaign, CampaignIndustry, DisplayObjective } from "@/lib/mock/types";

const TEMPLATE_ICON: Record<SetupTemplateId, IconType> = {
  recommended: HiOutlineSparkles,
  conversion: HiOutlineArrowTrendingUp,
  custom: HiOutlineAdjustmentsHorizontal,
};

interface CampaignSetupCardProps {
  draft: CampaignSetupDraft;
  onChange: (next: CampaignSetupDraft) => void;
  options: CampaignSetupOptions | null;
  loading: boolean;
  saving: boolean;
  confirmationPending?: boolean;
  error: string | null;
  created: Campaign | null;
  onSubmit: (saveAsDraft: boolean) => void;
  onRetry: () => void;
}

const objectives: Record<DisplayObjective, string> = {
  purchase: "구매 늘리기",
  app_install: "앱 설치 늘리기",
  leads: "문의 늘리기",
  visit: "사이트 방문 늘리기",
  reach: "많은 사람에게 알리기",
};

const industries: Record<CampaignIndustry, string> = {
  food: "식당 · 카페",
  beauty: "뷰티",
  education: "교육 · 학원",
  medical: "병원 · 의료",
  shopping: "쇼핑몰",
  realestate: "부동산",
  finance: "금융",
  it_app: "앱 · 온라인 서비스",
  etc: "기타",
};

const fieldStyle = css`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
`;

const labelStyle = css`
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-gray-800);
  font-size: 14px;
  font-weight: 600;
  svg { width: 19px; height: 19px; flex-shrink: 0; color: var(--color-gray-500); }
`;

const inputStyle = css`
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--color-gray-50);
  padding: 11px 12px;
  color: var(--color-gray-900);
  font-size: 14px;
  &:focus-visible { outline: 2px solid var(--color-blue-500); outline-offset: 2px; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const helperStyle = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;
`;

const pairStyle = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  @container campaign-setup (min-width: 460px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

function FieldLabel({ htmlFor, icon, children }: { htmlFor: string; icon: ReactNode; children: ReactNode }) {
  return <label htmlFor={htmlFor} css={labelStyle}>{icon}{children}</label>;
}

export function CampaignSetupCard({ draft, onChange, options, loading, saving, confirmationPending = false, error, created, onSubmit, onRetry }: CampaignSetupCardProps) {
  const id = useId();
  const [templateNote, setTemplateNote] = useState<string | null>(null);
  const connections = options?.trackingConnections ?? [];
  const selectedConnection = connections.find((connection) => connection.id === draft.trackingConnectionId);
  const recommendation = options?.budgetRecommendation;
  const validBudget = Number.isSafeInteger(draft.totalBudget) && draft.totalBudget >= 100000 && draft.totalBudget % 100 === 0;
  const validDates = isSetupDate(draft.startDate) && (draft.endDate === null || (isSetupDate(draft.endDate) && draft.endDate >= draft.startDate));
  const canSubmit = !saving && (confirmationPending || (!loading && options !== null && validBudget && validDates));
  // 기간·업종처럼 입력값만으로 알 수 있는 점검은 옵션 조회를 기다리지 않고 바로 반영되도록,
  // 아직 못 받은 값(recommendation/연결 여부)만 undefined로 넘긴다 — 드롭다운을 바꿀 때마다
  // 체크리스트 전체가 사라졌다 나타나던 걸 막는다.
  const optionsReady = !loading && options !== null;
  const checklist = evaluateSetupChecklist(draft, optionsReady ? recommendation : undefined, optionsReady ? Boolean(selectedConnection) : undefined);

  function pickTemplate(templateId: SetupTemplateId) {
    onChange(applySetupTemplate(templateId, draft, recommendation?.totalBudget ?? null));
    setTemplateNote(describeSetupTemplate(templateId));
  }

  if (created) {
    const nextSteps = describeSetupNextSteps(created);

    return (
      <Card role="status" css={css`border: 1px solid var(--color-green-100); padding: 24px 20px; overflow-wrap: anywhere;`}>
        <HiOutlineCheckCircle aria-hidden="true" css={css`width: 38px; height: 38px; color: var(--color-green-600); margin-bottom: 12px;`} />
        <h3 css={css`font-size: 18px; font-weight: 700; color: var(--color-gray-900);`}>설정을 저장했어요</h3>
        <p css={css`margin: 8px 0; font-size: 14px; color: var(--color-gray-700);`}>{created.name}</p>
        <p css={helperStyle}>광고는 아직 시작되지 않았어요.</p>

        <div css={css`margin-top: 16px; padding: 14px 16px; border-radius: 14px; background: var(--color-gray-50); display: flex; flex-direction: column; gap: 10px; text-align: left;`}>
          <p css={css`margin: 0; font-size: 13px; font-weight: 700; color: var(--color-gray-800);`}>다음 단계로 이런 걸 해보세요</p>
          {nextSteps.map((step) => (
            <div key={step.key} css={css`display: flex; flex-direction: column; gap: 4px;`}>
              <p css={helperStyle}>{step.text}</p>
              {step.href && (
                <Link href={step.href} css={css`display: inline-flex; align-items: center; gap: 5px; min-height: 32px; font-size: 13px; font-weight: 600; color: var(--color-blue-600);`}>
                  {step.linkLabel} <HiOutlineArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <Link href={`/campaigns/${encodeURIComponent(created.id)}`} css={css`display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; min-height: 44px; font-size: 14px; font-weight: 600; color: var(--color-blue-600);`}>
          저장한 캠페인 보기 <HiOutlineArrowRight aria-hidden="true" />
        </Link>
      </Card>
    );
  }

  return (
    <Card css={css`container-type: inline-size; container-name: campaign-setup; min-width: 0; border: 1px solid var(--border-subtle); padding: 20px 18px;`}>
      <header css={css`display: flex; align-items: center; gap: 12px; margin-bottom: 22px;`}>
        <span css={css`display: grid; place-items: center; flex-shrink: 0; width: 42px; height: 42px; border-radius: 14px; background: var(--color-blue-50); color: var(--color-blue-600);`}>
          <HiOutlineSparkles aria-hidden="true" size={23} />
        </span>
        <div>
          <h3 css={css`margin: 0 0 5px; font-size: 17px; font-weight: 700; color: var(--color-gray-900);`}>이렇게 시작해 볼까요?</h3>
          <p css={helperStyle}>확인하고, 한 번에 저장해요.</p>
        </div>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit(!selectedConnection); }}>
        <fieldset disabled={saving || confirmationPending} css={css`display: flex; flex-direction: column; min-width: 0; gap: 22px; border: 0; padding: 0; margin: 0;`}>
          <legend css={css`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);`}>새 캠페인 설정</legend>

          <div css={fieldStyle}>
            <p css={labelStyle}>빠른 시작</p>
            <OptionGrid columns={3}>
              {SETUP_TEMPLATES.map((template) => (
                <OptionCard
                  key={template.id}
                  icon={TEMPLATE_ICON[template.id]}
                  iconBg={template.id === "recommended" ? "var(--color-blue-50)" : template.id === "conversion" ? "var(--color-green-50)" : "var(--color-gray-100)"}
                  iconColor={template.id === "recommended" ? "var(--color-blue-600)" : template.id === "conversion" ? "var(--color-green-600)" : "var(--color-gray-600)"}
                  label={template.label}
                  desc={template.description}
                  onClick={() => pickTemplate(template.id)}
                />
              ))}
            </OptionGrid>
            {templateNote && (
              <p role="status" css={[helperStyle, css`display: flex; align-items: center; gap: 5px; color: var(--color-blue-600);`]}>
                <HiOutlineCheckCircle aria-hidden="true" size={14} />{templateNote}
              </p>
            )}
          </div>

          <div css={fieldStyle}>
            <FieldLabel htmlFor={`${id}-name`} icon={<HiOutlinePencilSquare aria-hidden="true" />}>캠페인 이름</FieldLabel>
            <input id={`${id}-name`} css={inputStyle} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="비워두면 이름을 정해드려요" maxLength={100} aria-describedby={`${id}-name-help`} />
            <p id={`${id}-name-help`} css={helperStyle}>이름이 없으면 캠페인_생성일시로 저장해요.</p>
          </div>

          <div css={css`padding: 16px; border-radius: 16px; background: var(--color-blue-50); display: flex; flex-direction: column; gap: 10px;`}>
            <FieldLabel htmlFor={`${id}-budget`} icon={<HiOutlineBanknotes aria-hidden="true" />}>총 예산</FieldLabel>
            <div css={css`position: relative;`}>
              <input id={`${id}-budget`} type="number" min={100000} step={100} required value={Number.isFinite(draft.totalBudget) && draft.totalBudget !== 0 ? draft.totalBudget : ""} onChange={(event) => onChange({ ...draft, totalBudget: Number(event.target.value) })} aria-invalid={!validBudget} aria-describedby={`${id}-budget-help`} css={[inputStyle, css`font-size: 23px; font-weight: 700; background: var(--color-surface, white); padding-right: 38px;`]} />
              <span aria-hidden="true" css={css`position: absolute; top: 16px; right: 16px; color: var(--color-gray-600); font-size: 14px;`}>원</span>
            </div>
            <p id={`${id}-budget-help`} css={helperStyle}>광고 기간 전체에 쓸 한도예요.<br />10만원 이상, 100원씩 입력해 주세요.</p>
            {loading ? <p role="status" css={helperStyle}>설정에 필요한 정보를 확인하고 있어요.</p> : recommendation?.totalBudget != null ? (
              <div css={css`display: flex; flex-direction: column; align-items: flex-start; gap: 6px;`}>
                <Badge tone={recommendation.source === "benchmark" ? "blue" : "gray"}>
                  {recommendation.source === "benchmark" ? "비슷한 광고를 참고했어요" : "일반적인 시작 금액이에요"}
                </Badge>
                <p css={helperStyle}>{recommendation.reason}</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => onChange({ ...draft, totalBudget: recommendation.totalBudget! })}>참고 금액 {formatKRW(recommendation.totalBudget)}원 쓰기</Button>
              </div>
            ) : (
              <div css={css`display: flex; align-items: flex-start; gap: 6px;`}>
                <HiOutlineInformationCircle aria-hidden="true" css={css`width: 16px; height: 16px; flex-shrink: 0; margin-top: 3px; color: var(--color-gray-500);`} />
                <p css={helperStyle}>추천 근거가 아직 부족해요.<br />기본 시작 금액은 10만원이에요.</p>
              </div>
            )}
          </div>

          <div css={pairStyle}>
            <div css={fieldStyle}>
              <FieldLabel htmlFor={`${id}-start`} icon={<HiOutlineCalendarDays aria-hidden="true" />}>시작일</FieldLabel>
              <input id={`${id}-start`} type="date" required css={inputStyle} value={draft.startDate} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} />
            </div>
            <div css={fieldStyle}>
              <FieldLabel htmlFor={`${id}-end`} icon={<HiOutlineCalendarDays aria-hidden="true" />}>종료일</FieldLabel>
              <input id={`${id}-end`} type="date" required={draft.endDate !== null} disabled={draft.endDate === null} min={draft.startDate} css={inputStyle} value={draft.endDate ?? ""} onChange={(event) => onChange({ ...draft, endDate: event.target.value })} />
              <label css={css`display: flex; gap: 8px; align-items: center; min-height: 32px; font-size: 13px; color: var(--color-gray-700); cursor: pointer;`}>
                <input type="checkbox" checked={draft.endDate === null} onChange={(event) => onChange({ ...draft, endDate: event.target.checked ? null : draft.startDate })} css={css`appearance: auto; width: 17px; height: 17px; flex-shrink: 0; margin: 0; accent-color: var(--color-blue-500);`} />
                종료일 없이 계속
              </label>
            </div>
          </div>
          {!validDates && <p role="status" css={[helperStyle, css`margin-top: -12px; color: var(--color-red-500);`]}>종료일은 시작일과 같거나 더 늦어야 해요.</p>}
          {draft.endDate === null && <p css={[helperStyle, css`margin-top: -12px;`]}>종료일이 없어도 총 예산은 늘어나지 않아요.</p>}

          <div css={pairStyle}>
            <div css={fieldStyle}>
              <FieldLabel htmlFor={`${id}-objective`} icon={<HiOutlineFlag aria-hidden="true" />}>광고 목표</FieldLabel>
              <select id={`${id}-objective`} css={inputStyle} value={draft.objective} onChange={(event) => onChange({ ...draft, objective: event.target.value as DisplayObjective })}>
                {Object.entries(objectives).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div css={fieldStyle}>
              <FieldLabel htmlFor={`${id}-industry`} icon={<HiOutlineShoppingBag aria-hidden="true" />}>어떤 일을 하나요?</FieldLabel>
              <select id={`${id}-industry`} css={inputStyle} value={draft.industry} onChange={(event) => onChange({ ...draft, industry: event.target.value as CampaignIndustry })}>
                {Object.entries(industries).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div css={fieldStyle}>
            <FieldLabel htmlFor={`${id}-tracking`} icon={<HiOutlineLink aria-hidden="true" />}>구매 · 문의 확인 코드</FieldLabel>
            <p css={helperStyle}>광고를 보고 어떤 행동을 했는지 확인해요.</p>
            <select id={`${id}-tracking`} disabled={loading || connections.length === 0} css={inputStyle} value={selectedConnection?.id ?? ""} onChange={(event) => onChange({ ...draft, trackingConnectionId: event.target.value || null })}>
              <option value="">{loading ? "연결을 확인하고 있어요" : connections.length === 0 ? "연결을 마친 코드가 없어요" : "사용할 코드를 골라 주세요"}</option>
              {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.siteUrl}</option>)}
            </select>
            {selectedConnection ? (
              <p css={[helperStyle, css`display: flex; align-items: center; gap: 5px; color: var(--color-green-600);`]}><HiOutlineCheckCircle aria-hidden="true" size={16} />연결을 확인했어요</p>
            ) : !loading && (
              <div css={css`display: flex; flex-direction: column; align-items: flex-start; gap: 4px;`}>
                <p css={helperStyle}>지금은 초안으로 저장할 수 있어요.</p>
                <Link href="/tracking" css={css`display: inline-flex; align-items: center; gap: 5px; min-height: 36px; font-size: 13px; font-weight: 600; color: var(--color-blue-600);`}>코드 설치 안내 <HiOutlineArrowRight aria-hidden="true" /></Link>
              </div>
            )}
          </div>
        </fieldset>

        {checklist.length > 0 && (
          <div role="status" css={css`margin-top: 18px; padding: 14px 16px; border-radius: 14px; background: var(--color-yellow-50); display: flex; flex-direction: column; gap: 8px;`}>
            <p css={css`margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-gray-800);`}>
              <HiOutlineExclamationTriangle aria-hidden="true" css={css`width: 17px; height: 17px; flex-shrink: 0; color: var(--color-yellow-600);`} />
              확인해 보세요
            </p>
            <ul css={css`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;`}>
              {checklist.map((item) => <li key={item.id} css={helperStyle}>· {item.text}</li>)}
            </ul>
          </div>
        )}

        {error && <div role="alert" css={css`margin-top: 18px; padding: 12px; border-radius: 12px; background: var(--color-red-50); color: var(--color-red-500); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere;`}>
          <p>{error}</p>
          {confirmationPending && <p>중복 저장을 막기 위해 설정을 잠갔어요. 아래 버튼으로 먼저 결과를 확인해 주세요.</p>}
          {!options && !confirmationPending && <Button type="button" variant="ghost" size="sm" onClick={onRetry} disabled={loading || saving}><HiOutlineArrowPath aria-hidden="true" />다시 확인</Button>}
        </div>}

        <footer css={css`margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 18px; display: flex; flex-direction: column; gap: 12px;`}>
          <p css={[helperStyle, css`display: flex; align-items: flex-start; gap: 6px;`]}><HiOutlineShieldCheck aria-hidden="true" css={css`flex-shrink: 0; width: 17px; height: 17px; margin-top: 2px;`} />저장만 해요. 광고는 시작되지 않아요.</p>
          <Button type="submit" size="lg" disabled={!canSubmit} css={css`width: 100%;`}>
            {saving ? <HiOutlineArrowPath aria-hidden="true" /> : <HiOutlineCheckCircle aria-hidden="true" />}
            {saving ? "저장하고 있어요" : confirmationPending ? "같은 설정으로 저장 결과 확인" : selectedConnection ? "이 설정으로 만들기" : "초안 저장"}
          </Button>
        </footer>
      </form>
    </Card>
  );
}
