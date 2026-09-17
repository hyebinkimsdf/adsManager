import Script from "next/script";

export default function PixelTestPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>픽셀 설치 테스트</h1>
      <p>이 페이지를 방문하면 AdsAI 픽셀이 page_view를 전송해요.</p>
      <button type="button" data-value="49000">
        테스트 구매 버튼
      </button>

      <Script
        src="https://ads-manager-iota-pearl.vercel.app/pixel.js"
        data-campaign-id="1630122c-e9ae-4df1-8018-a000c0e2f496"
        strategy="afterInteractive"
      />
    </div>
  );
}
