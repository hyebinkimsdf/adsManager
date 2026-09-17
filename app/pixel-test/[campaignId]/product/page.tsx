export default function PixelTestProductPage() {
  return (
    <div>
      <h2>상품 상세 페이지 테스트</h2>
      <p>상품 조회, 장바구니 담기, 바로 구매를 서로 다른 이벤트로 구분해서 추천하는지 확인해보세요.</p>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 12 }}>
        <h3>무선 이어폰 프로</h3>
        <p>129,000원</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" data-value="129000">
            장바구니 담기
          </button>
          <button type="button" data-value="129000">
            바로 구매
          </button>
        </div>
      </div>
      <p style={{ marginTop: 16 }}>
        <a href="#other-product">다른 상품 보러 가기</a>
      </p>
    </div>
  );
}
