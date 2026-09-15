/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { HiOutlineTrash, HiSparkles } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCampaignsQuery } from "@/lib/mock/store";
import { useConversionEventsQuery } from "@/lib/tracking/useConversionEvents";
import { useAudiencesQuery, createAudience, deleteAudience } from "@/lib/audiences/useAudiences";
import { DataState } from "@/components/ui/DataState";
import { buildAudienceRecommendations, type AudienceRecommendation } from "@/lib/audiences/insights";
import { estimateRetargetingSize, estimateConversionSize, LOOKBACK_OPTIONS } from "@/lib/audiences/estimate";
import { EVENT_LABEL, EVENT_ORDER } from "@/lib/tracking/events";
import { formatKRW, formatDateTime } from "@/lib/format";
import type { Audience, ConversionEventType } from "@/lib/mock/types";

type Tab = "retargeting" | "conversion" | "customer_list";

const TAB_LABEL: Record<Tab, string> = {
  retargeting: "리타겟팅",
  conversion: "전환추적 타겟",
  customer_list: "고객목록 타겟",
};

const TYPE_TONE: Record<Audience["type"], "blue" | "gray" | "green"> = {
  retargeting: "blue",
  conversion: "green",
  customer_list: "gray",
};

function nextId() {
  return `aud-${Date.now()}`;
}

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

export default function AudiencesPage() {
  const campaignsQuery = useCampaignsQuery();
  const eventsQuery = useConversionEventsQuery();
  const audiencesQuery = useAudiencesQuery();
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const audiences = audiencesQuery.data ?? [];

  const recommendations = useMemo(() => buildAudienceRecommendations(campaigns, events), [campaigns, events]);

  const [tab, setTab] = useState<Tab>("retargeting");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sourceCampaignIds, setSourceCampaignIds] = useState<string[]>([]);
  const [action, setAction] = useState<"visit" | "purchase">("visit");

  const [eventType, setEventType] = useState<ConversionEventType>("purchase");
  const [lookbackDays, setLookbackDays] = useState<number>(30);
  const [mode, setMode] = useState<"include" | "exclude">("include");

  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  const [recState, setRecState] = useState<Record<string, "idle" | "pending" | "done" | "error">>({});

  // 추천 카드는 폼에 값만 채워주는 게 아니라 그 자리에서 바로 만들어 저장한다 — 진짜 원클릭.
  async function handleRecommendationClick(rec: AudienceRecommendation) {
    setRecState((prev) => ({ ...prev, [rec.id]: "pending" }));
    try {
      const base = { id: nextId(), name: rec.draft.name, estimatedSize: rec.estimatedSize, createdAt: new Date().toISOString() };
      const audience: Audience =
        rec.draft.type === "retargeting"
          ? { ...base, type: "retargeting", sourceCampaignIds: rec.draft.sourceCampaignIds, action: rec.draft.action }
          : { ...base, type: "conversion", eventType: rec.draft.eventType, lookbackDays: rec.draft.lookbackDays, mode: rec.draft.mode };
      await createAudience(audience);
      setRecState((prev) => ({ ...prev, [rec.id]: "done" }));
    } catch {
      setRecState((prev) => ({ ...prev, [rec.id]: "error" }));
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    setRowCount(Math.max(0, lines.length - 1)); // 첫 줄은 헤더로 간주
  }

  const estimatedSize =
    tab === "retargeting"
      ? estimateRetargetingSize(events, sourceCampaignIds, action)
      : tab === "conversion"
      ? estimateConversionSize(events, eventType, lookbackDays)
      : rowCount;

  const canSave =
    name.trim().length > 0 &&
    (tab === "retargeting" ? sourceCampaignIds.length > 0 : tab === "customer_list" ? !!fileName : true);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const base = { id: nextId(), name: name.trim(), createdAt: new Date().toISOString() };
      let audience: Audience;
      if (tab === "retargeting") {
        audience = { ...base, type: "retargeting", sourceCampaignIds, action, estimatedSize };
      } else if (tab === "conversion") {
        audience = { ...base, type: "conversion", eventType, lookbackDays, mode, estimatedSize };
      } else {
        audience = { ...base, type: "customer_list", fileName: fileName ?? "customer_list.csv", rowCount, estimatedSize: rowCount };
      }
      await createAudience(audience);
      setName("");
      setSourceCampaignIds([]);
      setFileName(null);
      setRowCount(0);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const queries = [campaignsQuery, eventsQuery, audiencesQuery];
  if (queries.some((query) => query.isError)) return <DataState title="고객 데이터를 불러오지 못했어요" error onRetry={() => { queries.forEach((query) => void query.refetch()); }} />;
  if (queries.some((query) => query.isPending)) return <DataState title="고객 데이터를 불러오고 있어요" />;

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>타겟</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-600)" }}>
          다시 만나고 싶은 고객의 조건을 저장해요. 광고 매체로 보내는 기능은 아직 연결되지 않았어요.
        </p>
      </div>

      <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>추천은 저장된 조건으로 계산해요. 나노 AI는 사용하지 않아요. 최근 기록 최대 200건 기준이며, 같은 고객의 여러 행동이 포함될 수 있어요. 고객 파일은 이름과 줄 수만 저장해요.</p>
      {recommendations.length > 0 && (
        <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {recommendations.map((rec) => (
            <Card key={rec.id} css={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <span
                css={{
                  display: "flex",
                  height: "2rem",
                  width: "2rem",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  backgroundColor: "var(--color-blue-50)",
                }}
              >
                <HiSparkles style={{ height: "1rem", width: "1rem", color: "var(--color-blue-500)" }} aria-hidden="true" />
              </span>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)" }}>{rec.title}</p>
                <p css={{ marginTop: "0.25rem", fontSize: 13, lineHeight: 1.6, color: "var(--color-gray-600)" }}>{rec.detail}</p>
                <p css={{ marginTop: "0.375rem", fontSize: 12, color: "var(--color-gray-400)" }}>
                  예상 규모 {formatKRW(rec.estimatedSize)}건
                </p>
              </div>
              {(recState[rec.id] ?? "idle") === "done" ? (
                <span css={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--color-green-600)" }}>만들었어요</span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  css={{ flexShrink: 0 }}
                  disabled={recState[rec.id] === "pending"}
                  onClick={() => handleRecommendationClick(rec)}
                >
                  {recState[rec.id] === "pending" ? "만드는 중..." : recState[rec.id] === "error" ? "다시 시도" : rec.buttonLabel}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>새 타겟 만들기</CardTitle>
        </CardHeader>

        <div css={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} type="button" css={pillStyle(tab === t)} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
              타겟 이름
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 구매 이탈 방문자" css={inputStyle} />
          </div>

          {tab === "retargeting" && (
            <>
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  대상 캠페인 (최근 3개월 집행 기준)
                </label>
                <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {campaigns.map((c) => {
                    const active = sourceCampaignIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        css={pillStyle(active)}
                        onClick={() =>
                          setSourceCampaignIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  행동 기준
                </label>
                <div css={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" css={pillStyle(action === "visit")} onClick={() => setAction("visit")}>
                    방문(page_view)만
                  </button>
                  <button type="button" css={pillStyle(action === "purchase")} onClick={() => setAction("purchase")}>
                    구매(purchase)까지
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "conversion" && (
            <>
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  전환 이벤트
                </label>
                <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {EVENT_ORDER.map((type) => (
                    <button key={type} type="button" css={pillStyle(eventType === type)} onClick={() => setEventType(type)}>
                      {EVENT_LABEL[type]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  수집 기간
                </label>
                <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {LOOKBACK_OPTIONS.map((days) => (
                    <button key={days} type="button" css={pillStyle(lookbackDays === days)} onClick={() => setLookbackDays(days)}>
                      최근 {days}일
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  포함 / 제외
                </label>
                <div css={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" css={pillStyle(mode === "include")} onClick={() => setMode("include")}>
                    포함
                  </button>
                  <button type="button" css={pillStyle(mode === "exclude")} onClick={() => setMode("exclude")}>
                    제외
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "customer_list" && (
            <div>
              <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                고객 목록 CSV 업로드
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                css={{ fontSize: 13 }}
              />
              {fileName && (
                <p css={{ marginTop: "0.5rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  {fileName} · {formatKRW(rowCount)}행 인식됨 (첫 줄은 헤더로 처리)
                </p>
              )}
            </div>
          )}

          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-radius: var(--radius-sm);
              background-color: var(--color-blue-50);
              padding: 0.75rem 0.875rem;
            `}
          >
            <span css={{ fontSize: 12.5, color: "var(--color-blue-700)" }}>예상 규모</span>
            <span css={{ fontSize: 15, fontWeight: 700, color: "var(--color-blue-700)" }}>{formatKRW(estimatedSize)}건</span>
          </div>

          {saveError && <p css={{ fontSize: 12.5, color: "var(--color-red-500)" }}>{saveError}</p>}

          <Button disabled={!canSave || saving} onClick={handleSave} css={{ alignSelf: "flex-start" }}>
            {saving ? "저장 중..." : "타겟 저장"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>저장된 타겟</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column" }}>
          {audiences.map((a, i) => (
            <div
              key={a.id}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <Badge tone={TYPE_TONE[a.type]}>{TAB_LABEL[a.type]}</Badge>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-gray-900)" }}>{a.name}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 12, color: "var(--color-gray-400)" }}>
                  {formatDateTime(a.createdAt)} 생성 · 예상 규모 {formatKRW(a.estimatedSize)}건
                </p>
              </div>
              <button
                type="button"
                aria-label={`${a.name} 삭제`}
                onClick={() => { void deleteAudience(a.id).catch(() => setSaveError("고객 조건을 삭제하지 못했어요. 다시 눌러주세요.")); }}
                css={css`
                  display: flex;
                  height: 2rem;
                  width: 2rem;
                  flex-shrink: 0;
                  align-items: center;
                  justify-content: center;
                  border-radius: 9999px;
                  color: var(--color-gray-400);
                  &:hover {
                    background-color: var(--color-red-50);
                    color: var(--color-red-500);
                  }
                `}
              >
                <HiOutlineTrash style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
              </button>
            </div>
          ))}
          {audiences.length === 0 && (
            <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-600)" }}>
              아직 저장된 타겟이 없어요.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
