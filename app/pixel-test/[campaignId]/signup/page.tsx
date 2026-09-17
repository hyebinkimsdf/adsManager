"use client";

export default function PixelTestSignupPage() {
  return (
    <div>
      <h2>회원가입 페이지 테스트</h2>
      <p>폼을 제출하면 submit 트리거로 이벤트가 기록돼요.</p>
      <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
        <div>
          <label>
            이메일
            <br />
            <input type="email" placeholder="you@example.com" />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>
            비밀번호
            <br />
            <input type="password" />
          </label>
        </div>
        <button type="submit" style={{ marginTop: 12 }}>
          가입하기
        </button>
      </form>
    </div>
  );
}
