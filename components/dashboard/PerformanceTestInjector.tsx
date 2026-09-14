/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import { HiOutlineBeaker, HiCheck, HiExclamationTriangle } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { setTestPerformanceData } from "@/lib/mock/store";
import { validateTestPerformanceInput } from "@/lib/dev/testPerformanceData";
import { formatKRW } from "@/lib/format";
import type { Campaign } from "@/lib/mock/types";

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
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [spend, setSpend] = useState("100000");
  const [conversions, setConversions] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (campaigns.length === 0) return null;

  const spendNum = Number(spend);
  const revenueNum = Number(revenue);
  const roasPreview = spendNum > 0 ? Math.round((revenueNum / spendNum) * 100) : 0;

  function resetToIdle() {
    setState("idle");
    setError(null);
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
      </CardHeader>
      <p css={{ marginBottom: "0.875rem", fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-500)" }}>
        아직 실제 광고 매체와 연동돼 있지 않아 진짜 실적이 저절로 쌓이지 않아요. 여기서 최근 7일 실적을
        임의로 넣으면 실제 DB에 저장되고, 아래 &ldquo;확인해 볼 광고 설정&rdquo; 섹션이 그 값을 보고 다시 계산돼요 —
        숫자를 바꿔가며 이 섹션이 실제로 데이터에 반응하는지 확인해볼 수 있어요.
      </p>

      <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label css={fieldStyle}>
          캠페인
          <select
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              resetToIdle();
            }}
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

        <p css={{ fontSize: 12, color: "var(--color-gray-500)" }}>
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
      </div>
    </Card>
  );
}
