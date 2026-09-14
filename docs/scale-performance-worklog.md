# 대량 데이터·멀티유저 대응 작업 기록

간편 모드 UI 정리를 시작으로, 캠페인이 수천 건 규모로 늘어나는 상황을 가정한 성능 개선과
여러 유저 데이터를 한 DB에서 관리하는 구조를 추가한 과정을 원인·시도한 내용·결과 순서로
정리한다. 앞으로 이어지는 관련 개선 작업도 이 형식으로 이 문서에 이어서 기록한다.

## 목차

1. [내 계정 간편 드롭다운 제거](#1-내-계정-간편-드롭다운-제거)
2. ["최근 7일 캠페인 성과" 카드 제거](#2-최근-7일-캠페인-성과-카드-제거)
3. ["캠페인 한눈에 보기" 카드 제거](#3-캠페인-한눈에-보기-카드-제거)
4. [대량 데이터 환경에서 초기 화면 로딩 성능 개선](#4-대량-데이터-환경에서-초기-화면-로딩-성능-개선)
5. [여러 유저 데이터를 한 DB에서 관리하기 위한 ownerId 도입](#5-여러-유저-데이터를-한-db에서-관리하기-위한-ownerid-도입)
6. [캠페인 목록 페이지 렌더링 지연 해결](#6-캠페인-목록-페이지-렌더링-지연-해결)
7. [변경 파일 목록](#7-변경-파일-목록)
8. [캠페인 재방문 캐시 정책](#8-캠페인-재방문-캐시-정책)

---

## 1. 내 계정 간편 드롭다운 제거

**대상:** `components/layout/AppShell.tsx`

### 원인

사이드바 "내 계정" 영역에 있는 간편/전문가 모드 드롭다운(`AccountModeMenu`)을 없애달라는
요청을 받았다.

### 시도한 내용

- `AppShell.tsx`에서 `AccountModeMenu` import와 렌더링 제거
- 다른 곳에서 쓰이지 않는 걸 확인한 뒤 `AccountModeMenu.tsx` 파일 삭제
- 모드 상태 자체(`lib/ui/mode.ts`)와 모바일 헤더용 `ModeToggle`은 홈·캠페인 페이지 로직이
  여전히 의존하고 있어 그대로 유지

### 결과

`tsc`/`eslint` 통과. 드롭다운 UI만 제거되고 간편/전문가 모드 전환 기능 자체는 그대로 동작.

---

## 2. "최근 7일 캠페인 성과" 카드 제거

**대상:** `app/page.tsx`, `components/dashboard/CampaignRankingCard.tsx`

### 원인

간편 모드 홈 화면의 "최근 7일 캠페인 성과" 카드를 없애달라는 요청을 받았다.

### 시도한 내용

- `app/page.tsx`에서 `CampaignRankingCard` 렌더링·import·관련 변수 제거
- 다른 곳에서 쓰이지 않는 걸 확인한 뒤 컴포넌트 파일과, 이 카드 전용이던
  `lib/insights.ts`의 `rankCampaignsByMetric`/`RankMetric`/`CampaignRankRow` 삭제
- 2단 그리드였던 레이아웃을 단일 컬럼으로 정리

### 결과

`tsc`/`eslint` 통과. 죽은 코드 없이 카드와 전용 로직이 함께 정리됨.

---

## 3. "캠페인 한눈에 보기" 카드 제거

**대상:** `app/page.tsx`, `components/dashboard/CampaignSpotlightCards.tsx`

### 원인

"캠페인 한눈에 보기"와 "이번 주 추천 액션" 두 카드 중 하나만 남기고 싶다는 요청을 받고,
두 카드의 성격(상태 요약형 vs 실행 액션형)을 비교해 추천 액션 카드만 남기는 방향을 제안,
승인받았다.

### 시도한 내용

- `CampaignSpotlightCards` 렌더링·import·관련 변수(`spotlights`, `buildCampaignSpotlights`) 제거
- 다른 곳에서 쓰이지 않는 걸 확인한 뒤 컴포넌트 파일 삭제
- AI 주간 분석 응답의 `spotlights` 필드(스키마·프롬프트·`hydrateWeeklySpotlight`)는
  추천 액션과 같은 AI 호출에서 함께 오는 값이라 그대로 유지 — 화면엔 더 이상 안 쓰이지만,
  건드리면 AI 응답 계약 전체를 손봐야 해서 범위 밖으로 남김

### 결과

`tsc`/`eslint` 통과. 추천 액션 카드만 남고 AI 응답 계약은 건드리지 않음.

---

## 4. 대량 데이터 환경에서 초기 화면 로딩 성능 개선

**대상:** `app/api/campaigns/**`, `lib/insights.ts`, `lib/mock/store.ts`, `app/page.tsx`,
`components/assistant/AssistantDock.tsx`

### 원인

"가상의 대량 데이터를 DB에 넣고, 그 상태에서 API가 어떻게 처리되는지 보고 싶다"는 요청을
받았다. 조사해보니 `GET /api/campaigns`가 `SELECT * FROM Campaign`을 페이지네이션 없이
전부 반환하고, 클라이언트는 그 전체 배열 하나를 캐싱해 홈 대시보드·AI 어시스턴트가 전부
거기서 파생 계산을 하는 구조였다 — 캠페인이 수천 건이 되면 브라우저가 매번 캠페인마다
14일치 history JSON을 포함한 응답을 통째로 받아야 하는 구조.

### 시도한 내용

- **시드 스크립트 설계:** D1 REST(`d1Query`)는 쿼리당 바인딩 파라미터 100개 제한이 있어
  멀티로우 INSERT에 부적합 — 대신 `wrangler d1 execute --remote --file`로 리터럴 SQL
  파일을 직접 실행하는 방식을 채택(`scripts/generate-seed-sql.ts` 신규).
  - 1차 시도: INSERT 1건당 200행 → `SQLITE_TOOBIG` 실패(문장 하나가 너무 큼).
    ```
    ✘ [ERROR] statement too long: SQLITE_TOOBIG
    ```
    wrangler가 "실패 시 DB는 원상태로 롤백된다"고 안내해 안전하게 재시도 가능했음.
  - 2차 시도: INSERT 1건당 20행(문장 크기 약 33KB)으로 축소 → 성공. 캠페인 2,000건을
    99개 INSERT 문으로 나눠 실제 원격 D1에 삽입.
- **서버 집계 요약 엔드포인트 추가:** `app/page.tsx`에 있던 `combine`/`trend` 계산 로직을
  `lib/insights.ts`로 그대로 옮기고(로직 재구현 아님, 실행 위치만 서버로 이동),
  `buildDashboardSummary()`로 홈 화면이 필요로 하는 요약값만 만들어
  `GET /api/campaigns/summary`(신규)가 반환하도록 함.
- **옵션 페이지네이션:** `GET /api/campaigns`에 `?limit&cursor`(id를 2차 정렬키로 묶는
  keyset pagination) 옵션 추가. 파라미터 없으면 기존처럼 전체 반환(하위호환 유지).
- **AI 컨텍스트 크기 고정:** `pickTopCampaignsBySpend()`로 최근 7일 지출 상위 20개만 추려,
  `AssistantDock`이 `useCampaignsSummary().topCampaigns`를 쓰도록 변경 — 캠페인이 몇 건이든
  AI 프롬프트 크기가 일정하게 유지됨.

### 결과

로컬 dev 서버로 실제 원격 D1에 대고 시드 전/후를 직접 측정.

| | Before (8건) | After (2,008건) |
|---|---|---|
| `GET /api/campaigns`(무제한) | 9.4KB / 1.08s | 3.3MB / 1.74s |
| `GET /api/campaigns/summary`(신규) | 13.4KB / 0.12s | 38KB / 1.12s |

캠페인이 250배 늘어나도 홈 화면이 받는 페이로드는 거의 그대로임을 확인. `tsc`/`eslint`/
기존 테스트 55개 통과. `measurement`/`audiences`/`tracking`/`creatives`/`campaigns` 목록
페이지는 의도적으로 스코프에서 제외(여전히 무제한 조회) — 6번 항목에서 그중 하나가 실제
문제로 드러남.

---

## 5. 여러 유저 데이터를 한 DB에서 관리하기 위한 ownerId 도입

**대상:** `d1/schema.sql`, `d1/migrations/0003_add_campaign_owner_id.sql`,
`lib/campaigns/owner.ts`, `app/api/campaigns/**`

### 원인

"여러 유저가 있는 가정하에 DB를 관리하고 싶다"는 요청을 받았다. 조사해보니 이 프로젝트엔
로그인·세션이 없고(`proxy.ts`의 관리자 비밀번호 하나뿐), `Campaign` 등 모든 테이블에
소유자를 가리키는 컬럼 자체가 없는 완전한 단일 테넌트 구조였다. 사용자는 "로그인 구조까지는
필요 없고, 지금 사이트는 고정된 고유 id로 두되 DB엔 다른 유저 데이터도 넣어달라"고 범위를
좁혀줬다.

### 시도한 내용

- `Campaign.ownerId TEXT NOT NULL DEFAULT 'owner-primary'` 컬럼 추가
  (`d1/migrations/0003_add_campaign_owner_id.sql`). DEFAULT가 상수라 `ALTER TABLE` 한 번으로
  기존 행 전부가 자동으로 `owner-primary`로 백필됨.
- `lib/campaigns/owner.ts`에 고정 소유자 상수 `MY_OWNER_ID`를 두고, 모든 캠페인 API
  (GET 목록/단건/요약, PATCH, DELETE, POST, 시드 부트스트랩)의 쿼리에 `WHERE ownerId = ?`를
  추가 — 로그인 없이도 "내 계정" 데이터만 조회·수정되도록 함.
- `scripts/generate-seed-sql.ts`에 `--owner=`/`--prefix=` 옵션을 추가해 재사용, 가짜 유저
  5명(`owner-user-01~05`)에게 각각 22/47/31/25/40건씩 시드 삽입.

### 결과

원격 D1 실측:

| ownerId | 캠페인 수 |
|---|---|
| `owner-primary` (내 계정) | 2,008 |
| `owner-user-01`~`05` | 22 / 47 / 31 / 25 / 40 |

격리 확인: `/api/campaigns/summary`의 `totalCampaignCount`는 여전히 2008(다른 유저 데이터가
늘어도 안 보임), 다른 유저 캠페인 id(`camp-u01-000001`)를 직접 URL로 조회해도 404.
`tsc`/`eslint`/기존 테스트 55개 통과.

---

## 6. 캠페인 목록 페이지 렌더링 지연 해결

**대상:** `app/campaigns/page.tsx`

### 원인

"캠페인목록보기 누르면 캠페인 내용이 나와야해"라는 버그 리포트를 받았다. 5번 항목에서
스코프 아웃했던 `/campaigns` 목록 페이지가 실제 문제로 드러난 사례.

### 시도한 내용

- 먼저 실제로 broken인지부터 확인: Playwright를 격리 환경에 설치해 로컬 dev 서버를 대상으로
  "캠페인 목록 보기" 클릭을 재현. 콘솔 에러·페이지 에러 없음, `/api/campaigns` 200 응답,
  스크린샷에도 실제 캠페인 데이터가 정상 표시됨 — 기능 자체는 동작하고 있었음.
- 원인 재정의: 캠페인 2,008건을 필터링 없이 전부 `CampaignListItem`으로 렌더링하느라
  클릭 후 화면에 나타나기까지 렌더링에만 수 초가 걸렸다(body 텍스트 길이 111,602자).
  느린 게 "안 나오는 것"처럼 보였던 것.
- `visibleCount` state로 초기 30건만 렌더링하고, "더 보기" 버튼으로 30건씩 늘려가는 방식
  적용. 필터(전체/진행중/일시정지) 전환 시 `visibleCount`를 리셋하도록 함.

### 결과

같은 Playwright 스크립트로 재측정:

| | 수정 전 | 수정 후 |
|---|---|---|
| 렌더링된 본문 텍스트 양 | 111,602자(2,008건 전부) | 1,657자(30건만) |
| 클릭 → 반응 시간 | 1,076ms | 209ms |

"더 보기 (1978건 남음)" 버튼이 정상 노출되고 남은 건수도 정확함을 스크린샷으로 확인.
`tsc`/`eslint`/기존 테스트 55개 통과.

---

## 7. 변경 파일 목록

| 파일 | 변경 | 비고 |
|---|---|---|
| `components/layout/AppShell.tsx` | 수정 | 간편 모드 드롭다운 제거 |
| `components/layout/AccountModeMenu.tsx` | 삭제 | 더 이상 쓰이지 않음 |
| `components/dashboard/CampaignRankingCard.tsx` | 삭제 | "최근 7일 캠페인 성과" 카드 |
| `components/dashboard/CampaignSpotlightCards.tsx` | 삭제 | "캠페인 한눈에 보기" 카드 |
| `lib/insights.ts` | 수정 | `rankCampaignsByMetric` 등 삭제, `combine`/`trend`/`buildDashboardSummary`/`pickTopCampaignsBySpend` 추가 |
| `lib/campaigns/ensureSeed.ts` | 신규 | 데모 5건 부트스트랩 로직 추출, ownerId 스코프 |
| `lib/campaigns/owner.ts` | 신규 | 고정 소유자 상수 `MY_OWNER_ID` |
| `lib/campaigns/serialize.ts` | 수정 | `CampaignRow.createdAt` 필드 추가 |
| `app/api/campaigns/route.ts` | 수정 | `?limit&cursor` 옵션 페이지네이션, `ownerId` 필터 |
| `app/api/campaigns/[id]/route.ts` | 수정 | GET 추가, `ownerId` 필터 |
| `app/api/campaigns/summary/route.ts` | 신규 | 서버 집계 요약 엔드포인트 |
| `lib/mock/store.ts` | 수정 | `useCampaignsSummary`, 캐시 폴백 체인, mutation 후 파생 캐시 무효화 |
| `lib/mock/campaignsRepository.ts` | 수정 | 요약/단건 조회 함수 추가 |
| `app/page.tsx` | 수정 | 요약 API 소비로 전환, 카드 정리 |
| `app/campaigns/page.tsx` | 수정 | 목록 렌더링을 30건 단위 "더 보기"로 전환 |
| `components/assistant/AssistantDock.tsx` | 수정 | 전체 배열 대신 `topCampaigns` 사용 |
| `d1/schema.sql` | 수정 | `Campaign.ownerId` 컬럼 추가 |
| `d1/migrations/0003_add_campaign_owner_id.sql` | 신규 | ownerId 마이그레이션 |
| `scripts/generate-seed-sql.ts` | 신규 | 대량/유저별 시드 SQL 생성기 |
| `package.json` | 수정 | `seed:large` 스크립트 추가 |
| `.gitignore` | 수정 | 생성된 시드 SQL 파일 제외 |

## 8. 캠페인 재방문 캐시 정책

### 원인

2026-09-12 개발 서버 `localhost:3000`, 실제 D1의 내 계정 캠페인 2,008건으로 확인했다.
Playwright의 메뉴 링크 클릭으로 홈 → 캠페인 → 홈 → 캠페인을 이동하면 요약 API 2회,
목록 API 2회를 요청했다. 캐시는 있었지만 `staleTime` 기본값 0으로 재마운트 때 다시 조회했다.

매 단계 `page.goto()`로 전체 페이지를 열면 요약 4회, 목록 2회였다. 이는 메모리 캐시 초기화와
공통 AssistantDock의 요약 조회가 포함된 별도 조건이며, 메뉴 이동과 구분해야 한다.

### 시도한 내용

- `lib/queryClient.ts`: `["campaigns"]` 계열(목록·요약·상세)에만 `staleTime: 30_000` 적용.
  다른 API 정책과 `gcTime`은 유지했다. 30초는 초기 정책값이며 검증된 최적값은 아니다.
- `lib/mock/store.ts`: 데모 목록·요약과 다른 캐시에서 가져온 상세 미리보기를 `placeholderData`로
  분리했다. 실제 응답 캐시에 임시 데이터를 저장하지 않아 첫 조회는 바로 실행된다.
  기존 훅의 배열/요약 반환 계약과 데모 표시 폴백은 유지했다.
- 변경 성공 시 이전 목록·요약·해당 상세 조회의 캐시 반영을 취소한 뒤 최신 응답을 반영한다.
  진행 중이던 목록 재조회는 필요하면 재개하고, 활성 요약은 즉시 다시 조회한다.
- 단건 변경으로 나머지 목록의 신선도가 연장되지 않도록 기존 `dataUpdatedAt`을 보존한다.
  전체 목록을 받기 전 생성 요청이 끝나더라도 `[새 항목]`만 완전한 목록으로 저장하지 않는다.
- 삭제 시 해당 상세 캐시, 초기화 시 기존 상세 캐시를 제거한다. 실제 DB 변경을 동반하는
  동작은 모킹한 fetch로만 테스트했다. 브라우저 실측은 조회만 수행했다.

### 결과

동일한 개발 서버에서 별도의 새 브라우저 컨텍스트를 만들고, 각 단계의 API 완료와 짧은
안정화 구간을 기다렸다. 메뉴 이동 4단계는 30초 이내에 끝났다.

| 조건 | 개선 전 요약 / 목록 | 개선 후 요약 / 목록 |
| --- | --- | --- |
| 메뉴 링크 클릭, 홈 → 캠페인 → 홈 → 캠페인 | 2회 / 2회 | 1회 / 1회 |
| 각 단계 `page.goto()`로 전체 로드 | 4회 / 2회 | 4회 / 2회 |

개선 후 메뉴 이동의 첫 요약 요청은 607ms, 첫 목록 요청은 587ms였고 둘 다 HTTP 200이었다.
두 번째 홈·캠페인 방문에서는 API 요청이 없었다. 이 결과는 반복 조회 제거를 검증한 것이며,
첫 조회 지연이나 화면 렌더링 시간을 단축했다고 해석하지 않는다.

`tests/campaign-cache.test.cjs`에서 첫 실제 조회, 임시 데이터 비캐싱, TTL 내 재사용,
만료·무효화 후 재조회, 변경 후 캐시 정합성, 지연 GET의 덮어쓰기 방지를 확인한다.
새 캐시 테스트 18개를 포함한 전체 102개 테스트, 타입 검사, 변경 파일 ESLint,
프로덕션 빌드를 통과했다.

### 범위와 한계

- 30초가 되면 자동으로 요청하는 폴링이 아니다. 만료 후 다음 마운트/재연결 같은 재조회 계기가
  필요하다. 다른 탭·외부 시스템 변경은 즉시 동기화하지 않는다.
- 메모리 캐시이므로 새로고침에는 유지되지 않는다. 서버 캐시·영속 저장소는 추가하지 않았다.
- 목록/요약 API의 D1 전체 행 조회 구조는 그대로다. 첫 조회 비용은 별도 최적화 대상이다.
- 참고: [TanStack placeholder 데이터](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data),
  [변경 후 무효화](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).
