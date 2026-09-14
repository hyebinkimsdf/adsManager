# 온디바이스 AI 예열 개선 작업 기록

> 아래는 이전 변경 이력이다. 2026-09-12부터 기능 간 백그라운드 예열을 제거하고 화면 진입 시 준비하는 방식으로 변경했다. 현재 동작은 `on-device-ai-provider-worklog.md`를 참고한다.

온디바이스 AI 아키텍처를 코드 기준으로 분석해 나온 개선 방향 중, 다운로드 체감 속도에 직접
영향을 주는 두 가지(백그라운드 예열 범위, 활성화 재시도 시점)를 실제로 고친 과정을 원인·시도한
내용·결과로 정리한다.

## 목차

1. [백그라운드 예열이 대화 AI에만 종속되던 문제 수정](#1-백그라운드-예열이-대화-ai에만-종속되던-문제-수정)
2. [사용자 활성화 부족으로 멈춘 자원을 첫 상호작용에서 재시도](#2-사용자-활성화-부족으로-멈춘-자원을-첫-상호작용에서-재시도)
3. [변경 파일 목록](#3-변경-파일-목록)

---

## 1. 백그라운드 예열이 대화 AI에만 종속되던 문제 수정

**대상:** `lib/ai/onDeviceAiRuntime.ts`, `tests/on-device-ai-runtime.test.cjs`

### 원인

코드를 분석하던 중, `OnDeviceAiRuntime.publish()`가 만드는 전역 `snapshot.state`가 항상
`features[0]`(대화 AI)의 상태만 그대로 물려받고, 백그라운드 예열을 시작하는
`startBackground()`의 유일한 실행 조건도 이 값이 `"available"`인지였다는 걸 발견했다. 즉
캠페인 초안이나 추적 규칙을 아무리 먼저·성공적으로 써도, 대화 AI 자신이 한 번도 준비된 적
없으면 나머지 기능은 백그라운드에서 영원히 예열되지 않는 구조였다 — 캠페인 초안 페이지로 바로
들어와 대화를 한 번도 안 연 사용자는, 나중에 추적 규칙 기능을 처음 쓸 때마다 매번 콜드 스타트를
겪게 된다.

### 시도한 내용

- 기존 테스트(`tests/on-device-ai-runtime.test.cjs`)를 먼저 끝까지 읽어, "대화 우선" 동작을
  명시적으로 고정해 둔 테스트(`automatic preparation prioritizes chat and creates background
  features in parallel`)와 다중 기능 요청 시 호출 횟수를 정확히 검증하는 테스트(`explicit
  feature requests bypass the background queue and share translator creation`)를 확인 —
  게이트를 단순 삭제하지 않고 일반화해야 두 테스트가 깨지지 않는다는 걸 미리 파악했다.
- `startBackground(lifetime)` → `startBackground(lifetime, readyPrompt)`로 시그니처를 바꾸고,
  게이트를 "대화가 available인가"에서 "**방금 어떤 기능이든 자신의 의존성(모델 + 공유 번역기
  2개)까지 모두 available이 됐는가**"로 일반화했다. 백그라운드로 깨울 대상도 "대화를 제외한
  나머지"가 아니라 "**방금 준비된 기능을 제외한 나머지**"로 바꿨다.
- `prepareFeature`의 두 호출 지점(이미 준비된 세션을 재사용해 조기 반환하는 경로 / `Promise.all`
  완료 후 경로) 모두 새 시그니처에 맞게 `systemPrompt`를 넘기도록 수정했다.
- 새 시나리오를 검증하는 테스트를 추가했다: 대화를 한 번도 성공시키지 않은 채(`NotAllowedError`로
  계속 막아 둠) 캠페인 초안만 직접 준비시켜도 추적 규칙이 백그라운드로 깨어나는지 확인하는
  테스트(`preparing a non-chat feature first still wakes the remaining feature in the
  background`) — 옛 코드였다면 이 테스트는 실패했을 시나리오다.

### 결과

`tsc --noEmit`·`npm run lint`·`npm test`(77개, 기존 75개 회귀 없이 신규 2개 포함 전체 통과 —
특히 위험 요소로 예상했던 `explicit feature requests bypass the background queue` 테스트도
그대로 통과)·`npm run build` 모두 통과. 세 기능 중 어느 것을 먼저 쓰든 나머지 두 기능이
백그라운드로 예열되는 구조가 됐다.

---

## 2. 사용자 활성화 부족으로 멈춘 자원을 첫 상호작용에서 재시도

**대상:** `lib/ai/onDeviceAiRuntime.ts`, `components/providers/OnDeviceAiProvider.tsx`,
`tests/on-device-ai-runtime.test.cjs`

### 원인

Chrome 정책상 온디바이스 모델의 실제 다운로드는 사용자 활성화(user activation) 없이는 시작되지
않는다 — 코드도 이를 알고 `NotAllowedError`를 `"downloadable"` 상태로 구분해 처리하고 있었다.
지금까지는 이 상태에서 벗어나려면 사용자가 **AI가 명시된 버튼**("AI 사용 시작")을 직접 찾아
눌러야 했는데, 사용자 활성화 자체는 메뉴 클릭이든 탭 전환이든 페이지의 아무 첫 상호작용에서나
동일하게 발생한다. 즉 "AI 버튼을 실제로 찾아 누르기까지"의 지연이 불필요하게 존재했다.

### 시도한 내용

- `OnDeviceAiRuntime`에 `retryStalled()` 메서드를 추가했다 — `state === "downloadable"`인
  자원만 순회하며 `prepareFeature(prompt, "activation")`로 즉시 재시도한다. 이미 성공했거나
  지원되지 않는 자원은 건드리지 않는다(`Trigger` 타입에 로그 구분용 `"activation"` 값 추가).
- `OnDeviceAiProvider.tsx`에서 페이지의 첫 `pointerdown`/`keydown`(둘 중 먼저 오는 것, capture
  단계, 1회성) 시점에 `retryStalled()`를 호출하도록 배선하고, 어느 한쪽이 먼저 발생하면 나머지
  리스너도 정리하도록 처리했다. 언마운트 시에도 리스너를 해제한다.
- 검증 테스트를 추가했다(`retryStalled retries resources stuck without activation, but only
  once each`): 활성화 부족으로 멈춘 런타임이 `retryStalled()` 한 번으로 완전히 풀리는지, 이미
  준비된 뒤 다시 호출해도 중복 생성이 없는지 확인.

### 결과

`tsc --noEmit`·`npm run lint`·`npm test`(77개 전체 통과)·`npm run build` 모두 통과. 다만 실제
Chrome의 `navigator.userActivation`이 이 정도의 비동기 홉(마이크로태스크) 뒤에도 유효하게
유지되는지는 이 개발 환경에 브라우저가 없어 검증하지 못했다 — 상태 머신 로직만 목(mock)
기반으로 확인했고, 실제 체감 효과는 Chrome에서 직접 확인이 필요하다.

---

## 3. 변경 파일 목록

| 파일 | 변경 | 비고 |
|---|---|---|
| `lib/ai/onDeviceAiRuntime.ts` | 수정 | `startBackground`가 방금 준비된 기능 기준으로 나머지를 깨우도록 일반화, `retryStalled()` 신규, `Trigger`에 `"activation"` 추가 |
| `components/providers/OnDeviceAiProvider.tsx` | 수정 | 첫 `pointerdown`/`keydown`에서 `retryStalled()` 호출 배선 |
| `tests/on-device-ai-runtime.test.cjs` | 수정 | 신규 테스트 2개 추가(비대화 기능 우선 준비 시 전파, `retryStalled` 동작) |
