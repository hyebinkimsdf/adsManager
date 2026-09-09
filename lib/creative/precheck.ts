export type PrecheckStatus = "pass" | "warn" | "fail";

export interface PrecheckItem {
  id: string;
  category: "copy" | "image" | "landing";
  label: string;
  status: PrecheckStatus;
  detail: string;
}

export interface PrecheckReport {
  items: PrecheckItem[];
  /** 통과 100 · 주의 50 · 위반 0으로 가중 평균한 심사 통과 예상도(0~100) */
  score: number;
}

// 토스애즈 공통 심사 10개 기준 중 "허위·과장·기만"에 해당할 수 있는 절대적 표현 —
// 실제 반려 여부는 사람 심사에서 결정되므로, 여기서는 확인이 필요하다는 신호로만 쓴다.
const EXAGGERATION_PATTERNS = [
  "무조건",
  "100%",
  "최고",
  "국내 1위",
  "업계 1위",
  "완치",
  "보장",
  "부작용 없",
  "평생",
  "즉시 효과",
];

// 초상권·개인정보 노출 신호(전화번호·이메일 등) — 공통 심사 기준의 "제3자 권리·민감정보" 항목
const PHONE_PATTERN = /01[0-9][-.\s]?\d{3,4}[-.\s]?\d{4}/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// 토스애즈 배너 소재의 가로 이미지 권장 비율(a-d/features.md에서 확인된 값)
export const RECOMMENDED_IMAGE_RATIO = 1.91;
const IMAGE_RATIO_TOLERANCE = 0.08;

function excessiveSpecialChars(text: string): boolean {
  return /([!?★☆♥♡~]{3,})|(ㅋ{3,})|(ㅎ{3,})/.test(text);
}

export function checkCopy(headline: string, body: string): PrecheckItem[] {
  const combined = `${headline} ${body}`;
  const items: PrecheckItem[] = [];

  const matchedExaggeration = EXAGGERATION_PATTERNS.filter((p) => combined.includes(p));
  items.push(
    matchedExaggeration.length > 0
      ? {
          id: "copy-exaggeration",
          category: "copy",
          status: "warn",
          label: "허위·과장 표현 확인 필요",
          detail: `"${matchedExaggeration.join(", ")}" 같은 단정적 표현은 근거 자료 없이 쓰면 반려될 수 있어요.`,
        }
      : { id: "copy-exaggeration", category: "copy", status: "pass", label: "허위·과장 표현 없음", detail: "단정적·절대적 표현이 발견되지 않았어요." }
  );

  const hasPersonalInfo = PHONE_PATTERN.test(combined) || EMAIL_PATTERN.test(combined);
  items.push(
    hasPersonalInfo
      ? {
          id: "copy-personal-info",
          category: "copy",
          status: "fail",
          label: "개인정보 노출 의심",
          detail: "전화번호·이메일로 보이는 문자열이 카피에 포함돼 있어요. 소재 문구에서 제거해주세요.",
        }
      : { id: "copy-personal-info", category: "copy", status: "pass", label: "개인정보 노출 없음", detail: "전화번호·이메일 패턴이 발견되지 않았어요." }
  );

  items.push(
    excessiveSpecialChars(combined)
      ? {
          id: "copy-special-chars",
          category: "copy",
          status: "warn",
          label: "특수문자 남용 의심",
          detail: "!!!, ㅋㅋㅋ처럼 같은 문자를 3번 이상 반복하면 가독성 심사에서 지적될 수 있어요.",
        }
      : { id: "copy-special-chars", category: "copy", status: "pass", label: "특수문자 사용 적절", detail: "특수문자 반복이 발견되지 않았어요." }
  );

  const headlineLen = headline.trim().length;
  items.push(
    headlineLen === 0
      ? { id: "copy-length", category: "copy", status: "fail", label: "헤드라인 카피 없음", detail: "헤드라인 문구를 입력해주세요." }
      : headlineLen > 40
      ? {
          id: "copy-length",
          category: "copy",
          status: "warn",
          label: "헤드라인이 다소 길어요",
          detail: `${headlineLen}자예요. 배너 지면에서는 짧고 명확한 문구(40자 이내 권장)가 잘리지 않고 잘 보여요.`,
        }
      : { id: "copy-length", category: "copy", status: "pass", label: "헤드라인 길이 적절", detail: `${headlineLen}자로 적절해요.` }
  );

  return items;
}

export function checkImage(width: number, height: number): PrecheckItem[] {
  if (!width || !height) {
    return [
      {
        id: "image-ratio",
        category: "image",
        status: "warn",
        label: "이미지 미첨부",
        detail: "이미지를 첨부하면 권장 비율(1.91:1) 검사를 함께 해드려요.",
      },
    ];
  }
  const ratio = width / height;
  const withinRange = Math.abs(ratio - RECOMMENDED_IMAGE_RATIO) <= RECOMMENDED_IMAGE_RATIO * IMAGE_RATIO_TOLERANCE;
  return [
    withinRange
      ? {
          id: "image-ratio",
          category: "image",
          status: "pass",
          label: "이미지 비율 적절",
          detail: `${width}×${height} (비율 ${ratio.toFixed(2)}:1)로 권장 비율(1.91:1)에 가까워요.`,
        }
      : {
          id: "image-ratio",
          category: "image",
          status: "warn",
          label: "이미지 비율 확인 필요",
          detail: `${width}×${height} (비율 ${ratio.toFixed(2)}:1)로 권장 비율(1.91:1)과 차이가 있어요. 심사에서 크롭될 수 있어요.`,
        },
  ];
}

export function checkLandingUrl(url: string): PrecheckItem[] {
  if (!url.trim()) {
    return [{ id: "landing-url", category: "landing", status: "fail", label: "랜딩 URL 없음", detail: "랜딩 URL을 입력해주세요." }];
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return [{ id: "landing-url", category: "landing", status: "fail", label: "잘못된 URL 형식", detail: "http(s)://로 시작하는 전체 URL을 입력해주세요." }];
  }
  return [
    parsed.protocol === "https:"
      ? { id: "landing-url", category: "landing", status: "pass", label: "HTTPS 적용됨", detail: "안전한 프로토콜(HTTPS)을 사용하고 있어요." }
      : {
          id: "landing-url",
          category: "landing",
          status: "warn",
          label: "HTTPS 미적용",
          detail: "http만 사용 중이에요. 랜딩페이지는 https 적용을 권장해요.",
        },
  ];
}

export function buildPrecheckReport(items: PrecheckItem[]): PrecheckReport {
  const weight: Record<PrecheckStatus, number> = { pass: 100, warn: 50, fail: 0 };
  const score = items.length === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + weight[item.status], 0) / items.length);
  return { items, score };
}
