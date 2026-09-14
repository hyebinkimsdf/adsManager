/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { HiOutlineClipboard, HiOutlineCheck, HiOutlineSparkles } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/dashboard/EngineBadge";
import { useCampaignsQuery } from "@/lib/mock/store";
import { useConversionEventsQuery, conversionEventsQueryKey } from "@/lib/tracking/useConversionEvents";
import { DataState } from "@/components/ui/DataState";
import { sendTestEvent } from "@/lib/tracking/eventsRepository";
import { getLatestScan, getEventRules, saveEventRules } from "@/lib/tracking/rulesRepository";
import { EVENT_ORDER, EVENT_LABEL, EVENT_DESCRIPTION } from "@/lib/tracking/events";
import { useTrackingRules } from "@/lib/ai/useTrackingRules";
import type { TrackingRuleSuggestion } from "@/lib/ai/trackingRulesSchema";
import type { EngineKind } from "@/lib/ai/types";
import { queryClient } from "@/lib/queryClient";
import { formatDateTime, formatKRW } from "@/lib/format";
import type { ConversionEventType } from "@/lib/mock/types";

function noopSubscribe() {
  return () => {};
}

// window.location은 서버에 없는 값이라 useSyncExternalStore로 읽는다 — 서버 스냅샷은 빈 문자열을
// 반환해 최초 렌더는 항상 서버와 같고, 클라이언트에서 마운트된 뒤에만 실제 origin으로 갱신된다.
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // 클립보드 권한이 없으면 조용히 무시한다.
        }
      }}
    >
      {copied ? (
        <>
          <HiOutlineCheck style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" /> 복사됨
        </>
      ) : (
        <>
          <HiOutlineClipboard style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" /> 복사
        </>
      )}
    </Button>
  );
}

const codeBlockStyle = css`
  overflow-x: auto;
  border-radius: var(--radius-sm);
  background-color: var(--color-gray-900);
  padding: 0.875rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: #e5e7eb;
  white-space: pre;
`;

const siteScanQueryKey = (campaignId: string) => ["site-scan", campaignId] as const;
const eventRulesQueryKey = (campaignId: string) => ["event-rules", campaignId] as const;

/**
 * "GTM처럼 이벤트·변수를 직접 설정하지 않아도, 스크립트가 크롤링해온 요소를 AI가 보고
 * 알아서 전환 규칙을 제안해주는" 자동 설정 흐름. 제안은 체크박스로 검토한 뒤 한 번에 저장한다 —
 * 완전 무점검 자동화 대신, 신뢰를 위해 최소한의 승인 단계를 남겨둔다.
 */
function AutoConfigSection({ campaignId }: { campaignId: string }) {
  const scanQuery = useQuery({ queryKey: siteScanQueryKey(campaignId), queryFn: () => getLatestScan(campaignId) });
  const rulesQuery = useQuery({ queryKey: eventRulesQueryKey(campaignId), queryFn: () => getEventRules(campaignId) });
  const { generate } = useTrackingRules();

  const [suggestions, setSuggestions] = useState<TrackingRuleSuggestion[] | null>(null);
  const [enabledIndexes, setEnabledIndexes] = useState<Set<number>>(new Set());
  const [engine, setEngine] = useState<EngineKind | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = scanQuery.data;
  const activeRules = rulesQuery.data ?? [];

  async function handleGenerate() {
    if (!scan || scan.elements.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await generate(scan.elements);
      setSuggestions(result.rules);
      setEnabledIndexes(new Set(result.rules.map((r) => r.index)));
      setEngine(result.engine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 분석에 실패했어요.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleRule(index: number) {
    setEnabledIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSave() {
    if (!suggestions || !scan) return;
    setSaving(true);
    setError(null);
    try {
      const chosen = suggestions
        .filter((s) => enabledIndexes.has(s.index))
        .map((s) => ({
          selector: scan.elements[s.index]?.selector ?? "",
          trigger: s.trigger,
          eventType: s.eventType,
          label: s.label,
        }))
        .filter((r) => r.selector);
      await saveEventRules(campaignId, chosen);
      await queryClient.invalidateQueries({ queryKey: eventRulesQueryKey(campaignId) });
      setSuggestions(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 자동 설정</CardTitle>
        <EngineBadge engine={engine} analyzing={analyzing} />
      </CardHeader>
      <p css={{ marginBottom: "0.75rem", fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-500)" }}>
        사이트의 버튼을 읽고 무엇을 기록할지 추천해요. 확인하고 저장해야 적용돼요. 구매 버튼 클릭만으로 결제 완료를 확인할 수는 없어요.
      </p>

      {(scanQuery.isError || rulesQuery.isError) && <DataState title="사이트 정보나 저장된 설정을 불러오지 못했어요" error onRetry={() => { void scanQuery.refetch(); void rulesQuery.refetch(); }} />}
      {(scanQuery.isPending || rulesQuery.isPending) && <DataState title="사이트와 저장된 설정을 확인하고 있어요" />}
      {!scan && scanQuery.isSuccess && (
        <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>
          아직 스캔된 데이터가 없어요. 위 연동 코드를 설치한 사이트를 한 번 방문하면 자동으로 스캔돼요.
        </p>
      )}

      {scan && (
        <>
          <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <p css={{ fontSize: 12.5, color: "var(--color-gray-500)" }}>
              {formatDateTime(scan.scannedAt)}에 요소 {scan.elements.length}개를 찾았어요.
            </p>
            <Button size="sm" variant="secondary" disabled={analyzing || saving || scanQuery.isError || rulesQuery.isError || rulesQuery.isPending} onClick={handleGenerate}>
              <HiOutlineSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
              {analyzing ? "분석 중..." : suggestions ? "다시 분석" : "AI로 자동 설정 시작"}
            </Button>
          </div>

          {suggestions && suggestions.length === 0 && (
            <p css={{ marginBottom: "0.75rem", fontSize: 13, color: "var(--color-gray-500)" }}>
              전환으로 볼 만한 요소를 찾지 못했어요.
            </p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {suggestions.map((s) => {
                const el = scan.elements[s.index];
                const checked = enabledIndexes.has(s.index);
                return (
                  <label
                    key={s.index}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.625rem;
                      border-radius: var(--radius-sm);
                      border: 1px solid var(--border-subtle);
                      padding: 0.5rem 0.75rem;
                      cursor: pointer;
                    `}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleRule(s.index)} />
                    <div css={{ minWidth: 0, flex: 1 }}>
                      <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{s.label}</span>
                        <Badge tone="blue">{EVENT_LABEL[s.eventType]}</Badge>
                      </div>
                      <p css={{ marginTop: "0.125rem", fontSize: 12, color: "var(--color-gray-400)" }}>
                        {el?.text || el?.selector} · {s.trigger === "submit" ? "제출 시" : "클릭 시"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {suggestions && (
            <Button size="sm" variant="primary" disabled={saving || analyzing || rulesQuery.isError || enabledIndexes.size === 0} onClick={handleSave}>
              {saving ? "저장 중..." : `선택한 ${enabledIndexes.size}개 규칙 적용`}
            </Button>
          )}

          {error && <p css={{ marginTop: "0.75rem", fontSize: 12.5, color: "var(--color-red-500)" }}>{error}</p>}
        </>
      )}

      {activeRules.length > 0 && (
        <div css={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
          <p css={{ marginBottom: "0.5rem", fontSize: 12.5, fontWeight: 600, color: "var(--color-gray-700)" }}>
            저장된 자동 기록 설정 {activeRules.length}개 · 사이트 적용 여부는 별도 확인이 필요해요
          </p>
          <div css={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {activeRules.map((rule) => (
              <Badge key={rule.id} tone="gray">
                {EVENT_LABEL[rule.eventType]} · {rule.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function TrackingPage() {
  const campaignsQuery = useCampaignsQuery();
  const eventsQuery = useConversionEventsQuery();
  const campaigns = campaignsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const origin = useOrigin();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendingType, setSendingType] = useState<ConversionEventType | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0] ?? null;

  const snippet = selected
    ? `<script src="${origin || "https://<이 앱의 도메인>"}/pixel.js" data-campaign-id="${selected.id}"></script>`
    : "";
  const usageSnippet = `AdsAI.track("purchase", { value: 49000 });`;

  const campaignEvents = selected
    ? events.filter((e) => e.campaignId === selected.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    : [];

  async function handleTestSend(eventType: ConversionEventType) {
    if (!selected) return;
    setSendingType(eventType);
    setSendError(null);
    try {
      await sendTestEvent(selected.id, eventType, eventType === "purchase" ? 49000 : 0);
      await queryClient.invalidateQueries({ queryKey: conversionEventsQueryKey });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "전송에 실패했어요.");
    } finally {
      setSendingType(null);
    }
  }

  if (campaignsQuery.isError) return <DataState title="광고 목록을 불러오지 못했어요" error onRetry={() => void campaignsQuery.refetch()} />;
  if (campaignsQuery.isPending) return <DataState title="광고 목록을 불러오고 있어요" />;

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>전환 및 추적 연동</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          사이트에 코드를 넣고 방문·구매 기록이 들어오는지 확인해요.
        </p>
      </div>

      <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>테스트 전송은 저장 확인용이에요. 사이트 설치 완료나 새 광고의 연결 완료를 뜻하지 않아요.</p>
      <Card>
        <CardHeader>
          <CardTitle>연동할 캠페인</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {campaigns.map((c) => {
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                css={css`
                  border-radius: 9999px;
                  border: 1px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
                  background-color: ${active ? "var(--color-blue-50)" : "white"};
                  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-700)"};
                  padding: 0.375rem 0.75rem;
                  font-size: 13px;
                  font-weight: 500;
                `}
              >
                {c.name}
              </button>
            );
          })}
          {campaigns.length === 0 && <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>먼저 캠페인을 만들어주세요.</p>}
        </div>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>연동 코드</CardTitle>
            </CardHeader>
            <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <p css={{ marginBottom: "0.375rem", fontSize: 12.5, color: "var(--color-gray-500)" }}>
                  1. 사이트의 &lt;head&gt;에 픽셀 스크립트를 넣어주세요.
                </p>
                <div css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div css={[codeBlockStyle, { flex: 1 }]}>{snippet}</div>
                  <CopyButton text={snippet} />
                </div>
              </div>
              <div>
                <p css={{ marginBottom: "0.375rem", fontSize: 12.5, color: "var(--color-gray-500)" }}>
                  2. 사이트를 방문한 뒤 아래에서 기록할 버튼을 골라 저장해요. 구매 완료와 결제 금액은 결제가 끝난 곳에서 따로 보내주세요.
                </p>
                <div css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div css={[codeBlockStyle, { flex: 1 }]}>{usageSnippet}</div>
                  <CopyButton text={usageSnippet} />
                </div>
              </div>
            </div>
          </Card>

          <AutoConfigSection key={selected.id} campaignId={selected.id} />

          <Card>
            <CardHeader>
              <CardTitle>이벤트 종류 (수동 테스트 전송)</CardTitle>
            </CardHeader>
            <div css={{ display: "flex", flexDirection: "column" }}>
              {EVENT_ORDER.map((type, i) => (
                <div
                  key={type}
                  css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.625rem 0;
                    ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
                  `}
                >
                  <div css={{ minWidth: 0 }}>
                    <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{EVENT_LABEL[type]}</span>
                      <code css={{ fontSize: 11, color: "var(--color-gray-400)" }}>{type}</code>
                    </div>
                    <p css={{ marginTop: "0.125rem", fontSize: 12.5, color: "var(--color-gray-500)" }}>{EVENT_DESCRIPTION[type]}</p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={sendingType !== null} onClick={() => handleTestSend(type)}>
                    {sendingType === type ? "전송 중..." : "테스트 전송"}
                  </Button>
                </div>
              ))}
            </div>
            {sendError && (
              <p css={{ marginTop: "0.75rem", fontSize: 12.5, color: "var(--color-red-500)" }}>{sendError}</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최근 수집된 이벤트</CardTitle>
            </CardHeader>
            {eventsQuery.isError && <DataState title="최근 기록을 불러오지 못했어요" error onRetry={() => void eventsQuery.refetch()} />}
            {eventsQuery.isPending && <DataState title="최근 기록을 불러오고 있어요" />}
            <div css={{ display: "flex", flexDirection: "column" }}>
              {!eventsQuery.isError && campaignEvents.slice(0, 15).map((e, i) => (
                <div
                  key={e.id}
                  css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.625rem 0;
                    ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
                  `}
                >
                  <Badge tone={e.eventType === "purchase" ? "blue" : "gray"}>{EVENT_LABEL[e.eventType]}</Badge>
                  {e.source !== "live" && (
                    <Badge tone={e.source === "test" ? "gray" : "gray"}>
                      {e.source === "test" ? "테스트 전송" : "데모 데이터"}
                    </Badge>
                  )}
                  <span css={{ flex: 1, fontSize: 12.5, color: "var(--color-gray-500)" }}>{formatDateTime(e.occurredAt)}</span>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-800)" }}>
                    {e.value > 0 ? `${formatKRW(e.value)}원` : "-"}
                  </span>
                </div>
              ))}
              {eventsQuery.isSuccess && campaignEvents.length === 0 && (
                <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
                  아직 수집된 이벤트가 없어요. 위에서 테스트 전송을 눌러보세요.
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
