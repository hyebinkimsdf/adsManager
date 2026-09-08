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

// 키워드에 특정 연령대를 암시하는 표현이 있으면 그 연령대를 추천 태그로 보여준다.
// 실제 연령별 검색 데이터가 아니라 자주 쓰이는 표현 기반의 간단한 규칙이다.
const AGE_SIGNAL_KEYWORDS: Record<string, string[]> = {
  // "학생"은 "대학생"에도 포함되는 문자열이라 20대와 혼동되므로 더 구체적인 표현만 사용한다.
  "10대": ["청소년", "수능", "중학생", "고등학생", "교복", "입시"],
  "20대": ["대학생", "취준", "자취", "신입", "소개팅", "자기계발", "면접"],
  "30대": ["신혼", "직장인", "재테크", "웨딩", "이직"],
  "40대": ["자녀", "학부모", "내집마련", "가족여행", "사춘기"],
  "50대 이상": ["은퇴", "노후", "실버", "효도", "갱년기"],
};

// 키워드에서 연령대 신호를 못 찾았을 때 업종 기준으로 쓰는 기본 추천 연령대.
const INDUSTRY_AGE_FALLBACK: Record<CampaignIndustry, string[]> = {
  food: ["20대", "30대"],
  beauty: ["20대", "30대"],
  education: ["30대", "40대"],
  medical: ["30대", "40대", "50대 이상"],
  shopping: ["20대", "30대"],
  realestate: ["30대", "40대"],
  finance: ["30대", "40대"],
  it_app: ["20대", "30대"],
  etc: ["20대", "30대"],
};

/**
 * 선택된 키워드에서 연령대를 암시하는 표현을 찾아 추천 연령대를 뽑는다.
 * 신호를 하나도 못 찾으면 업종 기준 기본값으로 폴백한다.
 */
export function recommendAgeRanges(keywords: string[], industry: CampaignIndustry): string[] {
  const matched = new Set<string>();
  for (const keyword of keywords) {
    for (const [age, signals] of Object.entries(AGE_SIGNAL_KEYWORDS)) {
      if (signals.some((signal) => keyword.includes(signal))) matched.add(age);
    }
  }
  if (matched.size > 0) {
    return Object.keys(AGE_SIGNAL_KEYWORDS).filter((age) => matched.has(age));
  }
  return INDUSTRY_AGE_FALLBACK[industry];
}
