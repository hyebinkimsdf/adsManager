/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getLatestScan, getEventRules, saveEventRules, getInstalledPaths } from "@/lib/tracking/rulesRepository";
import { EVENT_ORDER, EVENT_LABEL, EVENT_DESCRIPTION } from "@/lib/tracking/events";
import { useTrackingRules } from "@/lib/ai/useTrackingRules";
import type { TrackingRuleSuggestion } from "@/lib/ai/trackingRulesSchema";
import type { EngineKind } from "@/lib/ai/types";
import { queryClient } from "@/lib/queryClient";
import { formatDateTime, formatKRW } from "@/lib/format";
import type { ConversionEventType, EventRule } from "@/lib/mock/types";

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
const installedPathsQueryKey = (campaignId: string) => ["installed-paths", campaignId] as const;

/** 스크립트를 설치한 사이트에서 실제로 방문이 확인된 경로 목록. 설치 코드 바로 아래 보여줘서,
 * "설치했는데 잘 됐는지" 굳이 개발자 도구를 안 열어봐도 여기서 바로 확인할 수 있게 한다. */
function InstalledPathsSection({ campaignId }: { campaignId: string }) {
  const query = useQuery({
    queryKey: installedPathsQueryKey(campaignId),
    queryFn: () => getInstalledPaths(campaignId),
    refetchInterval: 5000,
  });
  const paths = query.data ?? [];

  return (
    <div>
      <p css={{ marginBottom: "0.375rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>
        3. 설치가 끝나면 실제로 어느 경로에서 확인됐는지 여기 나타나요.
      </p>
      {query.isPending && <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>확인하고 있어요...</p>}
      {query.isError && <p css={{ fontSize: 13, color: "var(--color-red-600)" }}>설치 경로를 불러오지 못했어요.</p>}
      {query.isSuccess && paths.length === 0 && (
        <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>
          아직 설치가 확인되지 않았어요. 스크립트를 넣은 사이트를 한 번 방문하면 여기에 나타나요.
        </p>
      )}
      {paths.length > 0 && (
        <div css={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {paths.map((p) => (
            <div
              key={p.pageUrl}
              css={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                border-radius: var(--radius-sm);
                border: 1px solid var(--border-subtle);
                padding: 0.5rem 0.75rem;
              `}
            >
              <span
                css={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--color-gray-900)",
                }}
              >
                {p.pageUrl}
              </span>
              <span css={{ flexShrink: 0, fontSize: 12, color: "var(--color-gray-400)" }}>{formatDateTime(p.scannedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editEventType, setEditEventType] = useState<ConversionEventType>("page_view");
  const [ruleActionId, setRuleActionId] = useState<string | null>(null);
  const [ruleActionError, setRuleActionError] = useState<string | null>(null);

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

  function startEdit(rule: EventRule) {
    setEditingId(rule.id);
    setEditLabel(rule.label);
    setEditEventType(rule.eventType);
    setRuleActionError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // 규칙 저장 API가 "전체 교체" 방식이라, 수정/삭제도 지금 규칙 목록을 고쳐서 통째로 다시 저장한다.
  async function saveEdit(ruleId: string) {
    if (!editLabel.trim()) return;
    setRuleActionId(ruleId);
    setRuleActionError(null);
    try {
      const next = activeRules.map((r) => ({
        selector: r.selector,
        trigger: r.trigger,
        eventType: r.id === ruleId ? editEventType : r.eventType,
        label: r.id === ruleId ? editLabel.trim() : r.label,
      }));
      await saveEventRules(campaignId, next);
      await queryClient.invalidateQueries({ queryKey: eventRulesQueryKey(campaignId) });
      setEditingId(null);
    } catch (err) {
      setRuleActionError(err instanceof Error ? err.message : "수정에 실패했어요.");
    } finally {
      setRuleActionId(null);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("이 규칙을 삭제할까요?")) return;
    setRuleActionId(ruleId);
    setRuleActionError(null);
    try {
      const next = activeRules
        .filter((r) => r.id !== ruleId)
        .map((r) => ({ selector: r.selector, trigger: r.trigger, eventType: r.eventType, label: r.label }));
      await saveEventRules(campaignId, next);
      await queryClient.invalidateQueries({ queryKey: eventRulesQueryKey(campaignId) });
      if (editingId === ruleId) setEditingId(null);
    } catch (err) {
      setRuleActionError(err instanceof Error ? err.message : "삭제에 실패했어요.");
    } finally {
      setRuleActionId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 자동 설정</CardTitle>
        <EngineBadge engine={engine} analyzing={analyzing} />
      </CardHeader>
      <p css={{ marginBottom: "0.75rem", fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
        사이트의 버튼을 읽고 무엇을 기록할지 추천해요. 확인하고 저장해야 적용돼요. 구매 버튼 클릭만으로 결제 완료를 확인할 수는 없어요.
      </p>

      {(scanQuery.isError || rulesQuery.isError) && <DataState title="사이트 정보나 저장된 설정을 불러오지 못했어요" error onRetry={() => { void scanQuery.refetch(); void rulesQuery.refetch(); }} />}
      {(scanQuery.isPending || rulesQuery.isPending) && <DataState title="사이트와 저장된 설정을 확인하고 있어요" />}
      {!scan && scanQuery.isSuccess && (
        <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>
          아직 스캔된 데이터가 없어요. 위 연동 코드를 설치한 사이트를 한 번 방문하면 자동으로 스캔돼요.
        </p>
      )}

      {scan && (
        <>
          <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <p css={{ fontSize: 12.5, color: "var(--color-gray-600)" }}>
              {formatDateTime(scan.scannedAt)}에 요소 {scan.elements.length}개를 찾았어요.
            </p>
            <Button size="sm" variant="secondary" disabled={analyzing || saving || scanQuery.isError || rulesQuery.isError || rulesQuery.isPending} onClick={handleGenerate}>
              <HiOutlineSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
              {analyzing ? "분석 중..." : suggestions ? "다시 분석" : "AI로 자동 설정 시작"}
            </Button>
          </div>

          {suggestions && suggestions.length === 0 && (
            <p css={{ marginBottom: "0.75rem", fontSize: 13, color: "var(--color-gray-600)" }}>
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
          <div css={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeRules.map((rule) => {
              const isEditing = editingId === rule.id;
              const isBusy = ruleActionId === rule.id;
              return (
                <div
                  key={rule.id}
                  css={css`
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--border-subtle);
                    padding: 0.5rem 0.75rem;
                  `}
                >
                  {isEditing ? (
                    <>
                      <select
                        value={editEventType}
                        onChange={(e) => setEditEventType(e.target.value as ConversionEventType)}
                        css={css`
                          border-radius: var(--radius-sm);
                          border: 1px solid var(--border-subtle);
                          padding: 0.375rem 0.5rem;
                          font-size: 12.5px;
                        `}
                      >
                        {EVENT_ORDER.map((type) => (
                          <option key={type} value={type}>
                            {EVENT_LABEL[type]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        aria-label="규칙 설명"
                        css={css`
                          flex: 1;
                          min-width: 100px;
                          border-radius: var(--radius-sm);
                          border: 1px solid var(--border-subtle);
                          padding: 0.375rem 0.5rem;
                          font-size: 12.5px;
                        `}
                      />
                      <Button size="sm" variant="primary" disabled={isBusy || !editLabel.trim()} onClick={() => saveEdit(rule.id)}>
                        {isBusy ? "저장 중..." : "저장"}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={isBusy} onClick={cancelEdit}>
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge tone="gray">{EVENT_LABEL[rule.eventType]}</Badge>
                      <span css={{ flex: 1, minWidth: 100, fontSize: 12.5, color: "var(--color-gray-700)" }}>{rule.label}</span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => startEdit(rule)}
                        css={css`
                          font-size: 12px;
                          font-weight: 600;
                          color: var(--color-blue-600);
                          &:hover {
                            color: var(--color-blue-700);
                          }
                        `}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => deleteRule(rule.id)}
                        css={css`
                          font-size: 12px;
                          font-weight: 600;
                          color: var(--color-red-500);
                          &:hover {
                            color: var(--color-red-600);
                          }
                        `}
                      >
                        {isBusy ? "삭제 중..." : "삭제"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {ruleActionError && <p css={{ marginTop: "0.5rem", fontSize: 12.5, color: "var(--color-red-500)" }}>{ruleActionError}</p>}
        </div>
      )}
    </Card>
  );
}

const GUIDE_STEPS = [
  { title: "코드 설치", body: "위 연동 코드를 사이트에 붙여넣어요. 그 순간부터 방문 기록이 쌓이기 시작해요." },
  { title: "한 번 방문", body: "설치한 사이트를 한 번 열어보면, 그 페이지 안의 버튼과 폼을 훑어봐요." },
  { title: "추천 확인", body: "전환으로 볼만한 항목만 추려서 보여드려요. 필요한 것만 체크하면 돼요." },
  { title: "적용", body: "적용을 누르면 그때부터 방문자가 클릭하거나 폼을 제출할 때마다 자동으로 기록돼요." },
] as const;

/** AI 자동 설정 카드 옆에 붙는 사용법 안내. "분석·엔진·모델" 같은 말 없이, 실제로 뭘 누르고
 * 뭐가 쌓이는지만 순서대로 알려준다. */
function TrackingGuideCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>이렇게 써보세요</CardTitle>
      </CardHeader>
      <div css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {GUIDE_STEPS.map((step, i) => (
          <div key={step.title} css={{ display: "flex", gap: "0.75rem" }}>
            <span
              css={css`
                display: flex;
                flex-shrink: 0;
                align-items: center;
                justify-content: center;
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 9999px;
                background: var(--color-blue-50);
                font-size: 12px;
                font-weight: 700;
                color: var(--color-blue-600);
              `}
            >
              {i + 1}
            </span>
            <div>
              <p css={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-gray-900)" }}>{step.title}</p>
              <p css={{ marginTop: "0.125rem", fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div css={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
        <p css={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
          버튼을 눌렀다고 결제까지 끝난 건 아니에요. 결제가 실제로 끝나는 페이지에 아래 코드 한 줄만 넣어주면 정확하게 잡혀요.
        </p>
        <code
          css={css`
            display: block;
            margin-top: 0.5rem;
            overflow-x: auto;
            border-radius: var(--radius-sm);
            background: var(--color-gray-900);
            padding: 0.625rem 0.75rem;
            font-size: 12px;
            color: #e5e7eb;
            white-space: pre;
          `}
        >
          {`AdsAI.track("purchase", { value: 49000 });`}
        </code>
      </div>

      <div css={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
        <p css={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-gray-600)" }}>
          추천 목록이 비어있다면, 연동 코드를 설치한 사이트를 아직 안 열어봤을 확률이 높아요. 한 번 들렀다가 와서 &ldquo;다시 분석&rdquo;을 눌러보세요.
        </p>
      </div>
    </Card>
  );
}

function TrackingPageInner() {
  const campaignsQuery = useCampaignsQuery();
  const eventsQuery = useConversionEventsQuery();
  const campaigns = campaignsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const origin = useOrigin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get("campaignId");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendingType, setSendingType] = useState<ConversionEventType | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // 클릭으로 고른 캠페인(selectedId)이 우선이고, 아직 아무것도 안 골랐으면
  // 캠페인 상세에서 넘어온 ?campaignId= 값을, 그것도 없으면 첫 캠페인을 보여준다.
  const selected =
    campaigns.find((c) => c.id === selectedId) ??
    (campaignIdParam ? campaigns.find((c) => c.id === campaignIdParam) : null) ??
    campaigns[0] ??
    null;

  // 캠페인을 골랐는데 주소가 그대로면 새로고침하거나 링크를 공유했을 때 방금 고른 캠페인을 잃는다 —
  // 선택이 바뀔 때마다 주소의 campaignId를 같이 맞춰, 캠페인마다 경로가 서로 달라지게 한다.
  useEffect(() => {
    if (!selected || campaignIdParam === selected.id) return;
    router.replace(`/tracking?campaignId=${selected.id}`, { scroll: false });
  }, [selected, campaignIdParam, router]);

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
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-600)" }}>
          사이트에 코드를 넣고 방문·구매 기록이 들어오는지 확인해요.
        </p>
      </div>

      <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>테스트 전송은 저장 확인용이에요. 사이트 설치 완료나 새 광고의 연결 완료를 뜻하지 않아요.</p>
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
          {campaigns.length === 0 && <p css={{ fontSize: 13, color: "var(--color-gray-600)" }}>먼저 캠페인을 만들어주세요.</p>}
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
                <p css={{ marginBottom: "0.375rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  1. 사이트의 &lt;head&gt;에 픽셀 스크립트를 넣어주세요.
                </p>
                <div css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div css={[codeBlockStyle, { flex: 1 }]}>{snippet}</div>
                  <CopyButton text={snippet} />
                </div>
              </div>
              <div>
                <p css={{ marginBottom: "0.375rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>
                  2. 사이트를 방문한 뒤 아래에서 기록할 버튼을 골라 저장해요. 구매 완료와 결제 금액은 결제가 끝난 곳에서 따로 보내주세요.
                </p>
                <div css={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div css={[codeBlockStyle, { flex: 1 }]}>{usageSnippet}</div>
                  <CopyButton text={usageSnippet} />
                </div>
              </div>
              <InstalledPathsSection key={selected.id} campaignId={selected.id} />
            </div>
          </Card>

          <div
            css={css`
              display: grid;
              grid-template-columns: 1fr;
              gap: 1rem;
              align-items: start;
              @media (min-width: 900px) {
                grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
              }
            `}
          >
            <AutoConfigSection key={selected.id} campaignId={selected.id} />
            <TrackingGuideCard />
          </div>

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
                    <p css={{ marginTop: "0.125rem", fontSize: 12.5, color: "var(--color-gray-600)" }}>{EVENT_DESCRIPTION[type]}</p>
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
                  <span css={{ flex: 1, fontSize: 12.5, color: "var(--color-gray-600)" }}>{formatDateTime(e.occurredAt)}</span>
                  <span css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-800)" }}>
                    {e.value > 0 ? `${formatKRW(e.value)}원` : "-"}
                  </span>
                </div>
              ))}
              {eventsQuery.isSuccess && campaignEvents.length === 0 && (
                <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-600)" }}>
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

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingPageInner />
    </Suspense>
  );
}
