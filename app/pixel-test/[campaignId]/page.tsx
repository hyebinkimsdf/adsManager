"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Script from "next/script";
import { useCampaign } from "@/lib/mock/store";

function noopSubscribe() {
  return () => {};
}

// window.location은 서버에 없는 값이라 useSyncExternalStore로 읽는다 — pixel.js는
// 실제 origin이 있어야만 설치되므로, 서버 스냅샷(빈 문자열)일 땐 스크립트를 렌더하지 않는다.
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

export default function PixelTestPage() {
  const params = useParams<{ campaignId: string }>();
  const campaign = useCampaign(params.campaignId);
  const origin = useOrigin();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <p>
        <Link href={`/campaigns/${params.campaignId}`}>← 캠페인으로 돌아가기</Link>
      </p>
      <h1>픽셀 설치 테스트{campaign ? ` — ${campaign.name}` : ""}</h1>
      <p>이 페이지를 방문하면 이 캠페인의 AdsAI 픽셀이 page_view를 전송해요.</p>
      <button type="button" data-value="49000">
        테스트 구매 버튼
      </button>

      {origin && <Script src={`${origin}/pixel.js`} data-campaign-id={params.campaignId} strategy="afterInteractive" />}
    </div>
  );
}
