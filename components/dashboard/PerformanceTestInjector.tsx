/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useEffect } from "react";
import { atom, useAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { HiOutlineBeaker, HiCheck, HiExclamationTriangle, HiChevronRight } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { setTestPerformanceData, updatePublishDates } from "@/lib/mock/store";
import { validateTestPerformanceInput } from "@/lib/dev/testPerformanceData";
import { formatKRW } from "@/lib/format";
import type { Campaign } from "@/lib/mock/types";

type SaveState = "idle" | "saving" | "done" | "error";

// 이 카드는 페이지에 한 번만 쓰이는 단일 인스턴스라 모듈 스코프 atom으로 충분하다 — 다른 컴포넌트와
// 공유하지 않는다. 캠페인 목록에 따른 초기값은 useHydrateAtoms로 최초 렌더 시 한 번만 채운다.
const campaignIdAtom = atom("");
const spendAtom = atom("100000");
const conversionsAtom = atom("0");
const revenueAtom = atom("0");
const spendSaveStateAtom = atom<SaveState>("idle");
const spendSaveErrorAtom = atom<string | null>(null);

const openAtom = atom(false);
const startDateAtom = atom("");
const endDateAtom = atom<string | null>(null);
const dateSaveStateAtom = atom<SaveState>("idle");
const dateSaveErrorAtom = atom<string | null>(null);

const fieldStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 12.5px;
  color: var(--color-gray-600);
`;

const inputStyle = css`
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--color-gray-50);
  padding: 0.5rem 0.625rem;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-gray-900);
  outline: none;
  &:focus {
    border-color: var(--color-blue-500);
  }
`;

/**
 * 실제 매체 연동이 없어 진짜 실적이 저절로 안 쌓이는 지금, "확인해 볼 광고 설정" 섹션이 데이터
 * 변화에 실제로 반응하는지(하드코딩이 아니라는 것을) 눈으로 확인해보기 위한 테스트 전용 도구.
 * 여기서 값을 넣으면 실제로 D1에 저장되고, 아래 추천 섹션이 그 값으로 다시 계산된다.
 */
export function PerformanceTestInjector({ campaigns }: { campaigns: Campaign[] }) {
  useHydrateAtoms([
    [campaignIdAtom, campaigns[0]?.id ?? ""],
    [startDateAtom, campaigns[0]?.startDate ?? ""],
    [endDateAtom, campaigns[0]?.endDate ?? null],
  ] as const);
  const [campaignId, setCampaignId] = useAtom(campaignIdAtom);
  const [spend, setSpend] = useAtom(spendAtom);
  const [conversions, setConversions] = useAtom(conversionsAtom);
  const [revenue, setRevenue] = useAtom(revenueAtom);
  const [state, setState] = useAtom(spendSaveStateAtom);
  const [error, setError] = useAtom(spendSaveErrorAtom);

  const [open, setOpen] = useAtom(openAtom);
  const [startDate, setStartDate] = useAtom(startDateAtom);
  const [endDate, setEndDate] = useAtom(endDateAtom);
  const [dateState, setDateState] = useAtom(dateSaveStateAtom);
  const [dateError, setDateError] = useAtom(dateSaveErrorAtom);

  // campaignIdAtom은 모듈 스코프라 useHydrateAtoms는 앱 전체에서 딱 한 번만 초기값을 채운다 —
  // 그 최초 마운트 시점에 campaigns가 비어 있었다면(또는 그 뒤 캠페인이 삭제됐다면) 영원히 빈
  // 값에 머무를 수 있다. 그러면 저장 버튼이 빈 id로 PATCH를 보내 404/405로 계속 실패하므로,
  // 목록에 없는 선택은 여기서 첫 캠페인으로 되돌려 스스로 복구하게 한다.
  useEffect(() => {
    if (campaigns.length === 0 || campaigns.some((c) => c.id === campaignId)) return;
    const next = campaigns[0];
    setCampaignId(next.id);
    setStartDate(next.startDate ?? "");
    setEndDate(next.endDate ?? null);
  }, [campaigns, campaignId, setCampaignId, setStartDate, setEndDate]);

  if (campaigns.length === 0) return null;

  const spendNum = Number(spend);
  const revenueNum = Number(revenue);
  const roasPreview = spendNum > 0 ? Math.round((revenueNum / spendNum) * 100) : 0;

  function resetToIdle() {
    setState("idle");
    setError(null);
  }

  function resetDateState() {
    setDateState("idle");
    setDateError(null);
  }

  function selectCampaign(id: string) {
    setCampaignId(id);
    const next = campaigns.find((c) => c.id === id);
    setStartDate(next?.startDate ?? "");
    setEndDate(next?.endDate ?? null);
    resetToIdle();
    resetDateState();
  }

  async function handleApply() {
    const validated = validateTestPerformanceInput(Number(spend), Number(conversions), Number(revenue));
    if (!validated.ok) {
      setError(validated.error);
      setState("error");
      return;
    }
    setState("saving");
    setError(null);
    try {
      await setTestPerformanceData(campaignId, validated.value);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
      setState("error");
    }
  }

  async function handleApplyDates() {
    if (!startDate) {
      setDateError("시작일을 선택해 주세요.");
      setDateState("error");
      return;
    }
    if (endDate !== null && endDate < startDate) {
      setDateError("종료일은 시작일과 같거나 더 늦어야 해요.");
      setDateState("error");
      return;
    }
    setDateState("saving");
    setDateError(null);
    try {
      await updatePublishDates(campaignId, startDate, endDate);
      setDateState("done");
    } catch (err) {
      setDateError(err instanceof Error ? err.message : "저장하지 못했어요.");
      setDateState("error");
    }
  }

  return (
    <Card
      css={css`
        border: 1px dashed var(--color-gray-300);
      `}
    >
      <CardHeader>
        <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HiOutlineBeaker style={{ height: "1rem", width: "1rem", color: "var(--color-gray-500)" }} aria-hidden="true" />
          <CardTitle>테스트용 실적 데이터 설정</CardTitle>
          <Badge tone="red">테스트 전용</Badge>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "입력 영역 접기" : "입력 영역 펼치기"}
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            background: none;
            border: none;
            padding: 0.25rem;
            margin: -0.25rem;
            cursor: pointer;
            color: var(--color-gray-600);
            flex-shrink: 0;
          `}
        >
          <HiChevronRight
            aria-hidden="true"
            style={{
              height: "1rem",
              width: "1rem",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        </button>
      </CardHeader>

      {!open && (
        <p css={{ fontSize: 12.5, color: "var(--color-gray-600)" }}>
          접혀 있어요. 값을 바꾸려면 펼치세요.
        </p>
      )}

      {open && (
      <>
      <p css={{ marginBottom: "0.875rem", fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
        아직 실제 광고 매체와 연동돼 있지 않아 진짜 실적이 저절로 쌓이지 않아요. 여기서 최근 7일 실적을
        임의로 넣으면 실제 DB에 저장되고, 아래 &ldquo;확인해 볼 광고 설정&rdquo; 섹션이 그 값을 보고 다시 계산돼요 —
        숫자를 바꿔가며 이 섹션이 실제로 데이터에 반응하는지 확인해볼 수 있어요.
      </p>

      <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label css={fieldStyle}>
          캠페인
          <select
            value={campaignId}
            onChange={(e) => selectCampaign(e.target.value)}
            css={[inputStyle, css`appearance: auto;`]}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.625rem;
          `}
        >
          <label css={fieldStyle}>
            최근 7일 지출(원)
            <input
              inputMode="numeric"
              value={spend}
              onChange={(e) => {
                setSpend(e.target.value.replace(/[^0-9]/g, ""));
                resetToIdle();
              }}
              css={inputStyle}
            />
          </label>
          <label css={fieldStyle}>
            최근 7일 전환(건)
            <input
              inputMode="numeric"
              value={conversions}
              onChange={(e) => {
                setConversions(e.target.value.replace(/[^0-9]/g, ""));
                resetToIdle();
              }}
              css={inputStyle}
            />
          </label>
          <label css={fieldStyle}>
            최근 7일 매출(원)
            <input
              inputMode="numeric"
              value={revenue}
              onChange={(e) => {
                setRevenue(e.target.value.replace(/[^0-9]/g, ""));
                resetToIdle();
              }}
              css={inputStyle}
            />
          </label>
        </div>

        <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
          이 값대로 저장하면 ROAS {formatKRW(roasPreview)}%가 돼요. (150% 미만이면 예산 절감, 150% 이상이면 예산 증액 추천 대상이에요)
        </p>

        {state === "error" && error && (
          <p css={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 12.5, color: "var(--color-red-500)" }}>
            <HiExclamationTriangle style={{ height: "0.875rem", width: "0.875rem", flexShrink: 0 }} aria-hidden="true" />
            {error}
          </p>
        )}
        {state === "done" && (
          <p css={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 12.5, fontWeight: 500, color: "var(--color-green-600)" }}>
            <HiCheck style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
            저장했어요. 아래 추천 섹션이 갱신됐는지 확인해보세요.
          </p>
        )}

        <Button size="md" variant="secondary" onClick={handleApply} disabled={state === "saving"} css={{ alignSelf: "flex-start" }}>
          {state === "saving" ? "저장 중..." : "이 값으로 DB에 저장"}
        </Button>

        <div
          css={css`
            border-top: 1px dashed var(--color-gray-200);
            margin-top: 0.25rem;
            padding-top: 0.75rem;
            display: flex;
            flex-direction: column;
            gap: 0.625rem;
          `}
        >
          <p css={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-gray-700)" }}>게시 기간 수정</p>
          <p css={{ fontSize: 12, color: "var(--color-gray-600)" }}>
            이 캠페인을 언제 게시한 것으로 볼지 기간을 정해요. 경과일수 등 기간에 반응하는 로직을
            다양한 게시 시점으로 테스트할 때 써요.
          </p>
          <div css={css`display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.625rem;`}>
            <label css={fieldStyle}>
              시작일
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  resetDateState();
                }}
                css={inputStyle}
              />
            </label>
            <label css={fieldStyle}>
              종료일
              <input
                type="date"
                value={endDate ?? ""}
                disabled={endDate === null}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  resetDateState();
                }}
                css={inputStyle}
              />
            </label>
          </div>
          <label
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 12.5px;
              color: var(--color-gray-600);
              cursor: pointer;
            `}
          >
            <input
              type="checkbox"
              checked={endDate === null}
              onChange={(e) => {
                setEndDate(e.target.checked ? null : startDate);
                resetDateState();
              }}
              css={css`
                appearance: auto;
                width: 15px;
                height: 15px;
                margin: 0;
                accent-color: var(--color-blue-500);
              `}
            />
            종료일 없이 계속
          </label>

          {dateState === "error" && dateError && (
            <p css={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 12.5, color: "var(--color-red-500)" }}>
              <HiExclamationTriangle style={{ height: "0.875rem", width: "0.875rem", flexShrink: 0 }} aria-hidden="true" />
              {dateError}
            </p>
          )}
          {dateState === "done" && (
            <p css={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 12.5, fontWeight: 500, color: "var(--color-green-600)" }}>
              <HiCheck style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
              게시 기간을 저장했어요.
            </p>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleApplyDates}
            disabled={dateState === "saving"}
            css={{ alignSelf: "flex-start" }}
          >
            {dateState === "saving" ? "저장 중..." : "게시 기간 저장"}
          </Button>
        </div>
      </div>
      </>
      )}
    </Card>
  );
}
