# AI 역할 분리 작업 기록

"코드 = 판단과 실행, AI = 해석과 설명"이라는 원칙에 맞춰 이번 주 추천 액션 파이프라인을 고친
과정을 원인·시도한 내용·결과 순서로 정리한다. 관련 개선 작업은 앞으로도 이 형식으로 기록한다.

## 목차

1. [이번 주 추천 액션 — AI가 판단하지 않고 설명만 하도록 분리](#1-이번-주-추천-액션--ai가-판단하지-않고-설명만-하도록-분리)
2. [변경 파일 목록](#2-변경-파일-목록)

---

## 1. 이번 주 추천 액션 — AI가 판단하지 않고 설명만 하도록 분리

**대상:** `lib/insights.ts`, `lib/ai/weeklyAnalysisPrompt.ts`, `lib/ai/weeklyAnalysisSchema.ts`,
`lib/ai/useWeeklyAnalysis.ts`, `lib/ai/geminiClient.ts`, `app/api/ai/weekly-analysis/route.ts`,
`app/page.tsx`

### 원인

"AI가 예산을 15% 줄이겠습니다"처럼 AI가 직접 판단해서 실행까지 하는 구조보다, 코드가 계산한
안전한 변경안을 보여주고 사용자가 승인하면 실행하는 구조가 좋겠다는 방향을 사용자가 제시했다.
조사해보니 실행 시점(적용하기 클릭)은 이미 AI를 다시 호출하지 않고 코드가 검증한 값만 쓰고
있었지만, "어떤 캠페인을 어떤 종류(kind)로, 몇 %(percent)" 추천할지는 여전히 AI가 자유롭게
고르고 있었다([lib/ai/weeklyAnalysisPrompt.ts:7-10](lib/ai/weeklyAnalysisPrompt.ts#L7-L10) 원래
버전). 이 "판단"을 코드로 옮기는 게 유일하게 필요한 변경이었다.

### 시도한 내용

- `lib/insights.ts`의 `buildWeeklyRecommendations()`(룰 엔진: ROAS/트렌드 기준으로 캠페인·
  종류·퍼센트를 결정)를 "결정"과 "문구 생성" 두 함수로 쪼갰다.
  - `decideWeeklyRecommendations()`(비공개): 캠페인/kind/percent/근거 수치만 결정, 문구 없음
  - `buildWeeklyRecommendations()`: 위 결정 + 기존 템플릿 문구 → AI를 아예 못 쓸 때 쓰는 완전
    오프라인 폴백으로 유지
  - `buildRecommendationFacts()`(신규): 결정된 내용을 AI에게 보낼 형태로 변환
  - `applyAiExplanations()`(신규): AI가 써준 title/detail을 결정된 내용에 붙임. AI가 특정
    campaignId를 빼먹거나 모르는 값을 주면 그 항목만 조용히 템플릿 문구로 대체
- AI 프롬프트·스키마를 다시 작성: 캠페인 선택/kind/percent 필드를 스키마에서 제거하고,
  `{campaignId, title, detail}`만 요청하도록 바꿨다. 시스템 프롬프트에도 "campaignId, kind,
  percent는 이미 정해져 있으니 절대 바꾸지 말라"고 명시했다.
- 같은 프롬프트/스키마를 고치는 김에, 지난 작업에서 이미 화면에서 안 쓰이게 된(캠페인 한눈에
  보기 카드 삭제) `spotlights` AI 기능도 함께 제거했다 — `withSpotlightStats`,
  `buildCampaignSpotlights`, `hydrateWeeklySpotlight`, `CampaignSpotlight` 타입 전부 삭제.
- `app/page.tsx`의 AI 분석 effect를 `buildWeeklyCampaignInputs`/`hydrateWeeklyRecommendation`
  대신 `buildRecommendationFacts`/`applyAiExplanations`를 쓰도록 교체.

### 결과

`tsc`/`eslint`/기존 테스트 55개 통과. Playwright로 홈 화면을 직접 열어 확인 — 콘솔·페이지
에러 없이, 추천 액션 카드가 실제 캠페인명·퍼센트·예상 수치로 정상 렌더링됨(AI 미설정 환경이라
폴백 문구가 나왔지만, 그 폴백도 새 `decideWeeklyRecommendations` 경로를 그대로 타므로 AI 응답이
와도 같은 판단에 문구만 바뀌는 구조임을 확인).

---

## 2. 변경 파일 목록

| 파일 | 변경 | 비고 |
|---|---|---|
| `lib/insights.ts` | 수정 | 판단(`decideWeeklyRecommendations`)과 문구 생성 분리, `buildRecommendationFacts`/`applyAiExplanations` 추가, `buildWeeklyCampaignInputs`/`hydrateWeeklyRecommendation`/spotlights 관련 코드 삭제 |
| `lib/ai/weeklyAnalysisPrompt.ts` | 수정 | AI 입력을 "결정된 사실"로, 프롬프트를 "설명만 하라"로 재작성 |
| `lib/ai/weeklyAnalysisSchema.ts` | 수정 | 스키마를 `{campaignId, title, detail}`로 축소 |
| `lib/ai/useWeeklyAnalysis.ts` | 수정 | 새 타입·응답 필드(`explanations`) 반영 |
| `lib/ai/geminiClient.ts` | 수정 | 새 타입·응답 필드 반영 |
| `app/api/ai/weekly-analysis/route.ts` | 수정 | 새 타입 반영 |
| `lib/ai/weeklyAnalysisClient.ts` | 수정 | 새 타입 반영 |
| `app/page.tsx` | 수정 | AI 분석 effect를 새 함수로 교체 |
