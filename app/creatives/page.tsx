/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useMemo, useState } from "react";
import { HiCheckCircle, HiExclamationTriangle, HiXCircle, HiOutlineTrash } from "react-icons/hi2";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCampaignsQuery } from "@/lib/mock/store";
import { useRewardCampaignsQuery } from "@/lib/reward/useRewardCampaigns";
import { useCreativesQuery, createCreative, deleteCreative } from "@/lib/creative/useCreatives";
import { DataState } from "@/components/ui/DataState";
import { checkCopy, checkImage, checkLandingUrl, buildPrecheckReport, type PrecheckStatus } from "@/lib/creative/precheck";
import { PRODUCT_LABEL } from "@/lib/reward/rules";
import { formatDateTime } from "@/lib/format";
import type { Creative } from "@/lib/mock/types";

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

const STATUS_ICON: Record<PrecheckStatus, typeof HiCheckCircle> = {
  pass: HiCheckCircle,
  warn: HiExclamationTriangle,
  fail: HiXCircle,
};
const STATUS_COLOR: Record<PrecheckStatus, string> = {
  pass: "var(--color-green-600)",
  warn: "var(--color-yellow-600)",
  fail: "var(--color-red-500)",
};

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-green-600)";
  if (score >= 50) return "var(--color-yellow-600)";
  return "var(--color-red-500)";
}

function nextId() {
  return `creative-${Date.now()}`;
}

export default function CreativesPage() {
  const campaignsQuery = useCampaignsQuery();
  const rewardQuery = useRewardCampaignsQuery();
  const creativesQuery = useCreativesQuery();
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  const rewardCampaigns = useMemo(() => rewardQuery.data ?? [], [rewardQuery.data]);
  const creatives = creativesQuery.data ?? [];

  const targets = useMemo(
    () => [
      ...campaigns.map((c) => ({ id: c.id, name: c.name, badge: "디스플레이" })),
      ...rewardCampaigns.map((c) => ({ id: c.id, name: c.name, badge: PRODUCT_LABEL[c.productType] })),
    ],
    [campaigns, rewardCampaigns]
  );

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleImageFile(file: File) {
    setImageFileName(file.name);
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const report = useMemo(() => {
    const items = [
      ...checkCopy(headline, body),
      ...checkImage(imageDims?.width ?? 0, imageDims?.height ?? 0),
      ...checkLandingUrl(landingUrl),
    ];
    return buildPrecheckReport(items);
  }, [headline, body, imageDims, landingUrl]);

  const selectedTarget = targets.find((t) => t.id === campaignId);
  const canSave = !!selectedTarget && headline.trim().length > 0 && landingUrl.trim().length > 0;

  async function handleSave() {
    if (!selectedTarget) return;
    setSaving(true);
    setSaveError(null);
    try {
      const creative: Creative = {
        id: nextId(),
        campaignId: selectedTarget.id,
        campaignName: selectedTarget.name,
        headline: headline.trim(),
        body: body.trim(),
        imageWidth: imageDims?.width,
        imageHeight: imageDims?.height,
        landingUrl: landingUrl.trim(),
        precheckScore: report.score,
        precheckItems: report.items,
        createdAt: new Date().toISOString(),
      };
      await createCreative(creative);
      setHeadline("");
      setBody("");
      setLandingUrl("");
      setImageDims(null);
      setImageFileName(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const queries = [campaignsQuery, rewardQuery, creativesQuery];
  if (queries.some((query) => query.isError)) return <DataState title="광고 소재를 불러오지 못했어요" error onRetry={() => { queries.forEach((query) => void query.refetch()); }} />;
  if (queries.some((query) => query.isPending)) return <DataState title="광고 소재를 불러오고 있어요" />;

  return (
    <div css={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 css={{ fontSize: 18, fontWeight: 700, color: "var(--color-gray-900)" }}>광고 소재 · 기본 점검</h1>
        <p css={{ marginTop: "0.25rem", fontSize: 13, color: "var(--color-gray-500)" }}>
          문구와 이미지 크기를 정해진 기준으로 확인해요. 나노 AI나 실제 광고 심사는 아니에요.
        </p>
      </div>

      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          @media (min-width: 1024px) {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            align-items: flex-start;
          }
        `}
      >
        <Card css={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <CardHeader>
            <CardTitle>소재 입력</CardTitle>
          </CardHeader>

          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-500)" }}>연동 캠페인</label>
            <div css={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {targets.map((t) => (
                <button key={t.id} type="button" css={pillStyle(campaignId === t.id)} onClick={() => setCampaignId(t.id)}>
                  {t.name} <span css={{ opacity: 0.6 }}>· {t.badge}</span>
                </button>
              ))}
              {targets.length === 0 && <p css={{ fontSize: 13, color: "var(--color-gray-500)" }}>먼저 캠페인을 만들어주세요.</p>}
            </div>
          </div>

          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-500)" }}>헤드라인 카피</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="예: 지금 가입하면 첫 달 무료" css={inputStyle} />
          </div>

          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-500)" }}>본문 카피 (선택)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="상세 설명을 입력해주세요"
              css={[inputStyle, css`resize: vertical; font-family: inherit;`]}
            />
          </div>

          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-500)" }}>이미지 크기 확인 (파일은 저장하지 않아요)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
              css={{ fontSize: 13 }}
            />
            {imageFileName && imageDims && (
              <p css={{ marginTop: "0.375rem", fontSize: 12, color: "var(--color-gray-500)" }}>
                {imageFileName} · {imageDims.width}×{imageDims.height}px
              </p>
            )}
          </div>

          <div>
            <label css={{ marginBottom: "0.375rem", display: "block", fontSize: 12.5, color: "var(--color-gray-500)" }}>랜딩 URL</label>
            <input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://" css={inputStyle} />
          </div>

          {saveError && <p css={{ fontSize: 12.5, color: "var(--color-red-500)" }}>{saveError}</p>}

          <Button disabled={!canSave || saving} onClick={handleSave} css={{ alignSelf: "flex-start" }}>
            {saving ? "저장 중..." : "소재 정보 저장"}
          </Button>
        </Card>

        <Card css={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <CardHeader>
            <CardTitle>기본 점검 결과</CardTitle>
          </CardHeader>

          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-radius: var(--radius-sm);
              background-color: var(--color-gray-50);
              padding: 0.875rem 1rem;
            `}
          >
            <span css={{ fontSize: 13, color: "var(--color-gray-600)" }}>기본 점검 점수</span>
            <span css={{ fontSize: 26, fontWeight: 800, color: scoreColor(report.score) }}>{report.score}점</span>
          </div>

          <div css={{ display: "flex", flexDirection: "column" }}>
            {report.items.map((item, i) => {
              const Icon = STATUS_ICON[item.status];
              return (
                <div
                  key={item.id}
                  css={css`
                    display: flex;
                    align-items: flex-start;
                    gap: 0.625rem;
                    padding: 0.625rem 0;
                    ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
                  `}
                >
                  <Icon style={{ height: "1.125rem", width: "1.125rem", flexShrink: 0, marginTop: 1, color: STATUS_COLOR[item.status] }} aria-hidden="true" />
                  <div css={{ minWidth: 0 }}>
                    <p css={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>{item.label}</p>
                    <p css={{ marginTop: "0.125rem", fontSize: 12.5, lineHeight: 1.5, color: "var(--color-gray-500)" }}>{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p css={{ fontSize: 11.5, color: "var(--color-gray-400)" }}>
            참고용 점수예요. 심사 통과 확률이 아니며, 광고 매체로 심사를 신청하지 않아요.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>저장한 소재</CardTitle>
        </CardHeader>
        <div css={{ display: "flex", flexDirection: "column" }}>
          {creatives.map((c, i) => (
            <div
              key={c.id}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 0;
                ${i > 0 && "border-top: 1px solid var(--border-subtle);"}
              `}
            >
              <span css={{ flexShrink: 0, fontSize: 15, fontWeight: 800, color: scoreColor(c.precheckScore), width: "3rem" }}>
                {c.precheckScore}점
              </span>
              <div css={{ minWidth: 0, flex: 1 }}>
                <p css={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-gray-900)" }}>{c.headline}</p>
                <p css={{ marginTop: "0.125rem", fontSize: 12, color: "var(--color-gray-500)" }}>
                  {c.campaignName} · {formatDateTime(c.createdAt)}
                </p>
              </div>
              <Badge tone="gray">정보 저장됨</Badge>
              <button
                type="button"
                aria-label="삭제"
                onClick={() => { void deleteCreative(c.id).catch(() => setSaveError("소재를 삭제하지 못했어요. 다시 눌러주세요.")); }}
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
          {creatives.length === 0 && (
            <p css={{ padding: "1rem 0", textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
              아직 저장한 소재가 없어요.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
