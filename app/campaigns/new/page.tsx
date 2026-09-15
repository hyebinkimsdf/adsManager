/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlineChatBubbleLeftRight, HiOutlineCheckCircle, HiOutlineSparkles } from "react-icons/hi2";
import { CampaignSetupCard } from "@/components/campaigns/CampaignSetupCard";
import { Button } from "@/components/ui/Button";
import { useCampaignSetup } from "@/lib/campaigns/useCampaignSetup";

export default function NewCampaignPage() {
  const setup = useCampaignSetup();
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function fillFromMessage() {
    if (!message.trim() || setup.saving || setup.confirmationPending) return;
    setNote(setup.startFromMessage(message));
    setMessage("");
  }

  return (
    <div css={css`width: 100%; max-width: 720px; margin: 0 auto; padding-bottom: 32px;`}>
      <Link href="/campaigns" css={css`display: inline-flex; align-items: center; gap: 6px; min-height: 40px; margin-bottom: 16px; color: var(--color-gray-600); font-size: 13px;`}>
        <HiOutlineArrowLeft aria-hidden="true" />캠페인 목록
      </Link>

      <header css={css`margin-bottom: 24px;`}>
        <p css={css`display: flex; align-items: center; gap: 6px; color: var(--color-blue-600); font-size: 13px; font-weight: 600; margin-bottom: 10px;`}>
          <HiOutlineSparkles aria-hidden="true" size={18} />쉽게 시작하는 광고
        </p>
        <h1 css={css`color: var(--color-gray-900); font-size: clamp(24px, 4vw, 30px); font-weight: 700; letter-spacing: -0.03em;`}>새 캠페인 만들기</h1>
        <p css={css`margin-top: 8px; color: var(--color-gray-600); font-size: 14px; line-height: 1.7;`}>원하는 광고를 말해 주세요.<br />설정을 확인하고 한 번에 저장해요.</p>
      </header>

      {!setup.created && (
        <section aria-label="말로 광고 설정하기" css={css`margin-bottom: 20px; padding: 20px; border: 1px solid var(--color-blue-100); border-radius: 20px; background: var(--color-blue-50);`}>
          <form onSubmit={(event) => { event.preventDefault(); fillFromMessage(); }}>
            <label htmlFor="campaign-setup-message" css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--color-gray-800); font-size: 15px; font-weight: 600;`}>
              <HiOutlineChatBubbleLeftRight aria-hidden="true" size={21} />어떤 광고를 만들까요?
            </label>
            <textarea
              id="campaign-setup-message"
              value={message}
              onChange={(event) => { setMessage(event.target.value); setNote(null); }}
              disabled={setup.saving || setup.confirmationPending}
              placeholder="예: 카페 홍보, 총 20만원으로 7일 동안"
              rows={3}
              maxLength={2000}
              css={css`box-sizing: border-box; display: block; width: 100%; min-width: 0; resize: vertical; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px; background: var(--color-surface, white); color: var(--color-gray-800); font-size: 14px; line-height: 1.7; &:focus-visible { outline: 2px solid var(--color-blue-500); outline-offset: 2px; }`}
            />
            <div css={css`display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px;`}>
              <p css={css`font-size: 12px; color: var(--color-gray-600);`}>아래에서 직접 골라도 돼요.</p>
              <Button type="submit" disabled={!message.trim() || setup.saving || setup.confirmationPending} size="sm"><HiOutlineSparkles aria-hidden="true" />설정에 반영</Button>
            </div>
          </form>
          {note && <p role="status" css={css`display: flex; align-items: flex-start; gap: 6px; margin-top: 12px; font-size: 13px; line-height: 1.6; color: var(--color-blue-600);`}><HiOutlineCheckCircle aria-hidden="true" css={css`flex-shrink: 0; margin-top: 3px;`} />{note}</p>}
        </section>
      )}

      <CampaignSetupCard
        draft={setup.draft}
        onChange={setup.updateDraft}
        options={setup.options}
        loading={setup.loading}
        saving={setup.saving}
        confirmationPending={setup.confirmationPending}
        error={setup.error}
        created={setup.created}
        onSubmit={setup.submit}
        onRetry={setup.reloadOptions}
      />
    </div>
  );
}
