"use client";

export default function PixelTestLandingPage() {
  return (
    <div>
      <h2>랜딩 페이지 테스트</h2>
      <p>문의, 구독, 앱 설치처럼 서로 다른 유형의 버튼이 섞여 있을 때도 구분해서 추천하는지 확인해보세요.</p>

      <button type="button" style={{ marginTop: 12 }}>
        무료로 구독하기
      </button>

      <div style={{ marginTop: 12 }}>
        <a href="#app-download" onClick={(e) => e.preventDefault()}>
          앱 다운로드 받기
        </a>
      </div>

      <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 16 }}>
        <label>
          문의 내용
          <br />
          <textarea rows={3} />
        </label>
        <div>
          <button type="submit" style={{ marginTop: 8 }}>
            상담 신청하기
          </button>
        </div>
      </form>
    </div>
  );
}
