"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateCampaignSetup, type CampaignSetupDraft, type CampaignSetupOptions, type CampaignSetupRequest } from "./setup";
import { editSetupFromMessage, newSetupDraft, type SetupEditResult } from "./setupConversation";
import type { Campaign } from "@/lib/mock/types";
import { queryClient } from "@/lib/queryClient";
import { campaignsQueryKey, campaignSummaryQueryKey } from "@/lib/mock/store";

function describeDefaultedFields(matched: SetupEditResult["matched"]): string {
  const missing: string[] = [];
  if (!matched.objective) missing.push("목표");
  if (!matched.industry) missing.push("업종");
  if (!matched.budget) missing.push("예산");
  return missing.length === 0 ? "" : ` 기본값을 넣었어요: ${missing.join(" · ")}. 확인해 주세요.`;
}

export function useCampaignSetup(initiallyEnabled = true) {
  const [draft, setDraft] = useState(newSetupDraft);
  const current = useRef(draft);
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [optionsResult, setOptionsResult] = useState<{ key: string; value: CampaignSetupOptions | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const pendingRequest = useRef<CampaignSetupRequest | null>(null);
  const [created, setCreated] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const optionsKey = JSON.stringify([draft.objective, draft.industry, draft.startDate, draft.endDate, reload]);
  const options = optionsResult?.key === optionsKey ? optionsResult.value : null;
  const loading = enabled && optionsResult?.key !== optionsKey;
  const savingRef = useRef(false);
  const budgetChosen = useRef(false);
  // 이번 초안에서 자유 텍스트로 한 번이라도 설명했는지 — 첫 설명에서만 "기본값을 넣었어요"를 알려주고
  // 뒤이은 수정 메시지에서는 매번 반복해 알리지 않는다.
  const describedOnce = useRef(false);
  const mounted = useRef(true);
  const submitController = useRef<AbortController | null>(null);
  const updateDraft = useCallback((next: CampaignSetupDraft) => {
    if (savingRef.current || pendingRequest.current) return;
    if (next.totalBudget !== current.current.totalBudget) budgetChosen.current = true;
    current.current = next;
    setDraft(next);
    setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; submitController.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), 12000);
    const params = new URLSearchParams({ objective: draft.objective, industry: draft.industry, startDate: draft.startDate, endDate: draft.endDate ?? "" });
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/setup?${params}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "설정 정보를 가져오지 못했어요.");
        if (controller.signal.aborted) return;
        const data = result as CampaignSetupOptions;
        setOptionsResult({ key: optionsKey, value: data });
        // Options may finish while a POST is in flight. Never change its reviewed payload.
        if (savingRef.current || pendingRequest.current) return;
        const next = { ...current.current };
        if (!budgetChosen.current && data.budgetRecommendation.totalBudget !== null) next.totalBudget = data.budgetRecommendation.totalBudget;
        if (!next.trackingConnectionId && data.trackingConnections.length === 1) next.trackingConnectionId = data.trackingConnections[0].id;
        if (next.trackingConnectionId && !data.trackingConnections.some(c => c.id === next.trackingConnectionId)) next.trackingConnectionId = null;
        current.current = next;
        setDraft(next);
        setError(null);
      } catch (err) {
        if (!disposed && mounted.current) {
          setOptionsResult({ key: optionsKey, value: null });
          setError(controller.signal.aborted ? "연결 확인이 늦어지고 있어요. 다시 눌러주세요." : err instanceof Error ? err.message : "설정 정보를 가져오지 못했어요.");
        }
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [enabled, draft.objective, draft.industry, draft.startDate, draft.endDate, reload, optionsKey]);

  function startFromMessage(message: string, fresh = false): string {
    if (savingRef.current) return "저장 중이에요. 잠깐만 기다려주세요.";
    if (pendingRequest.current) return "먼저 카드에서 저장 결과를 확인해 주세요. 같은 설정으로 확인하니 중복으로 만들지 않아요.";
    const isReset = fresh || Boolean(created);
    const base = isReset ? newSetupDraft() : current.current;
    if (isReset) { budgetChosen.current = false; describedOnce.current = false; setCreated(null); }
    // 새로 시작하는 초안에서 말씀에 없어 기본값이 들어간 필드는 조용히 넘기지 않고 짚어준다 —
    // 이어서 고치는 메시지까지 매번 알리면 대화가 산만해지니 이 초안의 첫 설명에서만.
    const isFirstDescription = !describedOnce.current;
    const result = editSetupFromMessage(base, message);
    if (/(예산|금액|광고비|\d.*원)/.test(message)) budgetChosen.current = true;
    describedOnce.current = true;
    current.current = result.draft;
    setDraft(result.draft);
    setEnabled(true);
    setError(null);
    return isFirstDescription ? result.note + describeDefaultedFields(result.matched) : result.note;
  }

  async function submit(saveAsDraft: boolean) {
    if (savingRef.current || created) return;
    const validated = validateCampaignSetup(pendingRequest.current ?? { ...current.current, saveAsDraft });
    if (!validated.ok) { setError(validated.error); return; }
    const request = validated.value;
    pendingRequest.current = request;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    submitController.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/campaigns/setup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.outcome === "not_saved" || [400, 401, 403].includes(response.status)) {
          pendingRequest.current = null;
          if (mounted.current) setConfirmationPending(false);
        }
        throw new Error(data.error || "저장 결과를 확인하지 못했어요. 다시 확인해 주세요.");
      }
      if (!mounted.current) return;
      if (controller.signal.aborted) throw new DOMException("저장 확인 시간이 지났어요.", "AbortError");
      pendingRequest.current = null;
      setConfirmationPending(false);
      setCreated(data as Campaign);
      await queryClient.cancelQueries({ queryKey: campaignsQueryKey });
      queryClient.setQueryData(["campaigns", "detail", data.id], data);
      void queryClient.invalidateQueries({ queryKey: campaignsQueryKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: campaignSummaryQueryKey, exact: true });
    } catch (err) {
      if (mounted.current) {
        setConfirmationPending(pendingRequest.current !== null);
        setError(controller.signal.aborted ? "저장 결과를 확인하지 못했어요. 다시 누르면 같은 요청을 확인해요." : err instanceof Error ? err.message : "저장 결과를 확인하지 못했어요.");
      }
    } finally {
      clearTimeout(timer);
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return { draft, options, loading, saving, confirmationPending, error, created, updateDraft, startFromMessage, submit, reloadOptions: () => setReload(n => n + 1) };
}
