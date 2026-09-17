"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
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

// 실제 사이트는 한 페이지가 아니라 여러 유형(구매/가입/상품/랜딩)이 섞여 있으니,
// 스캔·자동 추천이 페이지 성격에 따라 달라지는지 여러 방향에서 확인할 수 있게 나눠뒀다.
const TEST_PAGES = [
  { slug: "", label: "구매 페이지" },
  { slug: "signup", label: "회원가입 페이지" },
  { slug: "product", label: "상품 상세 페이지" },
  { slug: "landing", label: "랜딩 페이지" },
];

export default function PixelTestLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ campaignId: string }>();
  const pathname = usePathname();
  const campaign = useCampaign(params.campaignId);
  const origin = useOrigin();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 640 }}>
      <p>
        <Link href={`/campaigns/${params.campaignId}`}>← 캠페인으로 돌아가기</Link>
      </p>
      <h1>픽셀 설치 테스트{campaign ? ` — ${campaign.name}` : ""}</h1>
      <p>실제 사이트의 여러 페이지 유형을 흉내낸 테스트예요. 오가면서 스캔·자동 추천이 어떻게 달라지는지 확인해보세요.</p>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1rem 0 1.5rem" }}>
        {TEST_PAGES.map((p) => {
          const href = `/pixel-test/${params.campaignId}${p.slug ? `/${p.slug}` : ""}`;
          const active = pathname === href;
          return (
            <Link
              key={p.slug || "base"}
              href={href}
              style={{
                borderRadius: 9999,
                border: active ? "1px solid #3182f6" : "1px solid #e5e7eb",
                background: active ? "#eef4ff" : "white",
                color: active ? "#1b64da" : "#374151",
                padding: "0.375rem 0.75rem",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      {children}

      {origin && <Script src={`${origin}/pixel.js`} data-campaign-id={params.campaignId} strategy="afterInteractive" />}
    </div>
  );
}
