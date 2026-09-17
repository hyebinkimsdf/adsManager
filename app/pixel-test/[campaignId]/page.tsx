export default function PixelTestPurchasePage() {
  return (
    <div>
      <h2>구매 페이지 테스트</h2>
      <p>구매 버튼을 눌러보면 page_view와 클릭 이벤트가 함께 기록돼요.</p>
      <button type="button" data-value="49000">
        테스트 구매 버튼
      </button>
    </div>
  );
}
