import type { CampaignIndustry, CampaignObjective } from "../mock/types";

// 업종·목표에 상관없이 광고 대행사가 메인 키워드 뒤에 흔히 붙이는 범용 수식어.
// "필라테스" + 이 목록 = "필라테스 위치", "필라테스 가격" 같은 서브(롱테일) 키워드가 된다.
export const GENERIC_MODIFIERS = ["위치", "가격", "상담", "후기", "예약", "추천", "비교", "근처"];

export const OBJECTIVE_TAILS: Record<CampaignObjective, string[]> = {
  conversion: ["가격", "구매", "할인"],
  traffic: ["후기", "정보", "비교"],
  awareness: ["신제품", "브랜드"],
  leads: ["상담 신청", "무료 상담"],
};

// 네이버 검색광고 키워드도구에 넘길 업종별 시드 키워드 (공백 없는 단일 자연어 검색어)
export const INDUSTRY_SEED_KEYWORD: Record<CampaignIndustry, string> = {
  food: "맛집",
  beauty: "뷰티",
  education: "학원",
  medical: "병원",
  shopping: "쇼핑몰",
  realestate: "부동산",
  finance: "대출",
  it_app: "앱",
  etc: "광고",
};

export const INDUSTRY_TAILS: Record<CampaignIndustry, string[]> = {
  food: ["맛집", "메뉴", "예약"],
  beauty: ["후기", "시술 후기", "이벤트"],
  education: ["학원 후기", "커리큘럼", "등록 상담"],
  medical: ["병원 후기", "진료 예약", "비급여 안내"],
  shopping: ["할인", "특가", "무료배송"],
  realestate: ["분양", "매물", "시세"],
  finance: ["무료 상담", "금리 비교", "한도 조회"],
  it_app: ["다운로드", "무료체험", "가입 혜택"],
  etc: ["이벤트", "프로모션"],
};
