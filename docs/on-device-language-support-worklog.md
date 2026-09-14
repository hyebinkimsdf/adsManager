# 온디바이스 AI 한국어 지원 작업 기록

크롬 Prompt API의 "No output language was specified" 경고를 계기로, 온디바이스 AI 4곳 중
한 곳만 한국어 우회 처리가 안 돼 있던 걸 찾아 고친 과정을 원인·시도한 내용·결과로 정리한다.

## 목차

1. [이번 주 추천 액션 온디바이스 경로에 번역 우회를 추가](#1-이번-주-추천-액션-온디바이스-경로에-번역-우회를-추가)
2. [4개 온디바이스 훅의 중복 로직을 공용 훅으로 통합](#2-4개-온디바이스-훅의-중복-로직을-공용-훅으로-통합)
3. [변경 파일 목록](#3-변경-파일-목록)

---

## 1. 이번 주 추천 액션 온디바이스 경로에 번역 우회를 추가

**대상:** `lib/ai/weeklyAnalysisPrompt.ts`, `lib/ai/weeklyAnalysisSchema.ts`, `lib/ai/useWeeklyAnalysis.ts`

### 원인

사용자가 브라우저 콘솔에서 "No output language was specified... [de, en, es, fr, ja]" 경고를
보고 원인을 물었다. 처음엔 "크롬 Prompt API가 한국어를 공식 지원하지 않아서 생기는, 코드로는
못 고치는 경고"라고 잘못 답했다 — 이 프로젝트 안에 이미 정확한 우회 방법이 구현되어 있는 걸
놓쳤었다. 사용자가 `lib/ai/useLanguageModel.ts`의 `Translator` 관련 코드를 직접 짚어줘서 다시
살펴보니, 온디바이스 AI를 쓰는 4곳(`useLanguageModel`/채팅, `useCampaignDraft`/캠페인 초안,
`useTrackingRules`/자동 추적 설정, `useWeeklyAnalysis`/이번 주 추천) 중 **3곳은 이미** "모델은
영어로 돌리고 Translator API로 한국어↔영어를 왕복 번역하는" 우회 패턴을 쓰고 있었고,
`useWeeklyAnalysis.ts` 한 곳만 이 패턴이 빠져 있었다 — 마침 지난 작업에서 AI 역할 분리를 위해
직접 고쳤던 바로 그 파일이었다.

### 시도한 내용

- 다른 3곳(특히 구조가 가장 비슷한 `useTrackingRules.ts`)을 그대로 참고해 같은 패턴을 이식했다.
- `lib/ai/weeklyAnalysisPrompt.ts`에 영어 시스템 프롬프트(`WEEKLY_ANALYSIS_SYSTEM_PROMPT_EN`)와
  영어 사용자 턴 빌더(`buildWeeklyAnalysisUserTurnEn`) 추가. 기존 한국어 버전은 클라우드
  경로(Gemini, 언어 제한 없음)용으로 그대로 유지.
- `lib/ai/weeklyAnalysisSchema.ts`에 구조는 같고 `description`만 영어인
  `WEEKLY_ANALYSIS_RESPONSE_SCHEMA_EN` 추가.
- `lib/ai/useWeeklyAnalysis.ts`를 재작성: `Translator` 세션 두 개(ko→en, en→ko)를 준비하고,
  `campaignId`/`kind`/`percent`/수치처럼 언어와 무관한 값은 그대로 두고 `campaignName`/
  `ageRange`만 영어로 번역해 모델에 보낸 뒤, 응답의 `title`/`detail`만 다시 한국어로 번역.
  타임아웃도 번역 왕복이 늘어난 만큼 6초 → 9초로 늘렸다(`useLanguageModel.ts`와 동일 근거).

### 결과

`tsc`/`eslint`/기존 테스트 55개 통과. Playwright로 홈 화면을 다시 열어 확인 — 콘솔·페이지
에러 없이 이전과 동일하게 정상 렌더링됨(테스트 환경인 헤드리스 크로미움엔
`window.LanguageModel`/`window.Translator`가 없어 실제 온디바이스 경로 자체는 못 태웠지만,
새 코드가 로드·컴파일되는 과정에서 아무 것도 깨지지 않았음을 확인). 이제 4개 온디바이스 AI
기능 모두 같은 방식으로 한국어를 지원하는 구조가 됐다.

---

## 2. 4개 온디바이스 훅의 중복 로직을 공용 훅으로 통합

**대상:** `lib/ai/useOnDeviceAi.ts`(신규), `useWeeklyAnalysis.ts`, `useCampaignDraft.ts`,
`useTrackingRules.ts`, `useLanguageModel.ts`, `lib/ai/trackingRulesPrompt.ts`

### 원인

1번 작업으로 4개 온디바이스 훅이 전부 같은 패턴(세션 준비·번역기 준비·availability 체크·타임아웃
처리)을 쓰게 됐는데, 사용자가 "매번 번역 로직을 명시하는 것보다 한곳에서 관리하는 게 낫지 않냐"고
지적했다. 실제로 파일마다 ~150줄이 거의 그대로 복붙돼 있었고(`EN_TEXT` 상수, `Translators`
인터페이스, `worstOf`, `ensureSession`, `ensureTranslators`, cleanup, `AvailabilityState` 타입
정의까지), 기능 고유 로직은 "무엇을 번역할지"와 "클라우드/최종 폴백"뿐이었다.

### 시도한 내용

- `lib/ai/useOnDeviceAi.ts` 신규: 제네릭 훅 `useOnDeviceAi<TInput, TEnglishOutput, TOutput>(config)`로
  세션·번역기 준비/availability/cleanup을 전부 옮기고, `runOnDevice(input)` 하나만 노출(실패 시
  항상 null, 호출부가 클라우드/최종 폴백을 이어가도록). `Promise.race([시도, 타임아웃])` 반복 패턴도
  `raceWithTimeout()` 공용 헬퍼로 뽑음.
- `config`는 각 훅 파일에서 **모듈 스코프 상수**로 한 번만 만들어 넘긴다 — 컴포넌트 렌더마다 새
  객체를 만들면 `useOnDeviceAi` 내부 `useCallback`들이 매번 재생성돼서다.
- 4곳 중 유일하게 입력·출력 모양이 안 맞던 두 곳을 손봤다:
  - `useTrackingRules`는 검증 시 원본 요소 개수(`elements.length`)가 필요해서, `parseResponse`
    시그니처에 원본(번역 전) 입력을 두 번째 인자로 추가(`(raw, input) => ...`).
  - `trackingRulesPrompt.ts`의 `buildTrackingRulesUserTurnEn`이 받던 모양(`{index,tag,type,text}[]`)을
    `SiteElement[]`를 직접 받아 내부에서 투영하도록 바꿔, `translateRequest`가 입력과 같은 타입을
    돌려주는 다른 3곳과 패턴을 맞췄다.
  - `useLanguageModel`은 `ask(message, campaigns)`처럼 인자가 2개라 `{message, campaigns}` 객체
    하나로 묶어 `TInput`으로 썼다.
- 각 훅에서 안 쓰이던 걸 발견해서 같이 정리: `useLanguageModel()`이 반환하던 최상위 `engine` 필드는
  유일한 호출부(`AssistantDock.tsx`)가 구조분해도 안 하던 죽은 값이라 제거.

### 결과

`tsc`/`eslint`/기존 테스트 55개 통과. 4개 훅 파일 총 줄 수가 (원래 약 928줄) →
(새 공용 파일 222줄 포함) 589줄로 줄었다 — 새 기능(`useOnDeviceAi.ts`) 하나를 추가했는데도 전체는
더 짧아진 것. Playwright로 홈(이번 주 추천)·`/campaigns/new`(캠페인 초안)·`/tracking`(자동 추적
설정) 3개 페이지와 채팅창(AssistantDock 열기 → 메시지 전송)까지 직접 열어서 콘솔·페이지 에러
없음을 확인했다.

---

## 3. 변경 파일 목록

| 파일 | 변경 | 비고 |
|---|---|---|
| `lib/ai/weeklyAnalysisPrompt.ts` | 수정 | 영어 시스템 프롬프트·사용자 턴 빌더 추가 |
| `lib/ai/weeklyAnalysisSchema.ts` | 수정 | 영어 응답 스키마 추가 |
| `lib/ai/useOnDeviceAi.ts` | 신규 | 4개 훅 공용: 세션·번역기·availability·타임아웃, `raceWithTimeout` |
| `lib/ai/useWeeklyAnalysis.ts` | 수정 | 공용 훅 사용, 249줄 → 103줄 |
| `lib/ai/useCampaignDraft.ts` | 수정 | 공용 훅 사용, 208줄 → 82줄 |
| `lib/ai/useTrackingRules.ts` | 수정 | 공용 훅 사용, 212줄 → 82줄 |
| `lib/ai/useLanguageModel.ts` | 수정 | 공용 훅 사용, 259줄 → 100줄, 안 쓰이던 top-level `engine` 필드 제거 |
| `lib/ai/trackingRulesPrompt.ts` | 수정 | `buildTrackingRulesUserTurnEn`이 `SiteElement[]`를 직접 받도록 변경 |
