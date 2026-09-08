# 캠페인 요약 작업 기록

간편모드 캠페인 요약 화면을 설계하고 구현한 뒤, 작업 내용을 커밋으로 나누고
GitHub에 올리는 과정에서 겪은 문제를 원인·결과·수정 순서로 정리한다.

## 목차

1. [간편모드 캠페인 요약 화면 구현](#1-간편모드-캠페인-요약-화면-구현)
2. [작업 내용을 커밋 4개로 분리](#2-작업-내용을-커밋-4개로-분리)
3. [push 오류 — Repository not found](#3-push-오류--repository-not-found)
4. [push 오류 — 실제 원인은 계정 권한](#4-push-오류--실제-원인은-계정-권한)
5. [변경 파일 목록](#5-변경-파일-목록)

---

## 1. 간편모드 캠페인 요약 화면 구현

**대상:** `/campaigns` 페이지, 간편모드 전용 화면

### 원인

사용자가 AI 광고 관리 요약 화면 스크린샷을 제시하고, 캠페인이 간편모드일 때
같은 형태로 보여달라고 요청했다.

### 결과

적용 범위가 홈 화면인지 캠페인 목록 페이지인지 불명확해 사용자에게 확인한
결과, `/campaigns` 페이지로 결정했다. 기존 간편모드 홈 화면 구성요소는
그대로 두고 별도로 구현했다.

### 수정

- ROAS 기준 좋아요 / 무난해요 / 아쉬워요 3단계 분류 로직 추가
- AI 마스코트 헤더, 상태 카드, 추천 배너, 바로가기 카드 4종 구현
- 간편모드일 때 요약 화면을, 전문가모드일 때 기존 목록을 표시

**검증:** `tsc --noEmit`, `eslint` 통과 확인. Playwright로 간편모드·전문가모드·
목록 전환·AI 추천 적용·리포트 안내 문구까지 실제 화면을 캡처해 동작을 확인했다.

---

## 2. 작업 내용을 커밋 4개로 분리

**대상:** git, 최초 커밋 이력 없음

### 원인

저장소에 커밋이 하나도 없는 상태에서 "지금까지 내용을 나눠서 커밋해달라"는
요청을 받았다. 세션에서 수정한 3개 파일에는 기존 내용과 새 기능 코드가 함께
들어 있었다.

### 결과

`git restore --staged`는 HEAD가 없어 실패했다. 대신 `git rm --cached`로
신규 컴포넌트만 스테이징에서 제외해, 기존 상태와 새 기능을 커밋 단위로
분리할 수 있었다.

### 수정

- 수정된 3개 파일을 세션 이전 원본 내용으로 되돌려 초기 커밋
- ROAS 분류 로직 커밋
- 신규 컴포넌트 4개 + 노란색 토큰 커밋
- 페이지 연결(모드 분기) 커밋

```
$ git log --oneline
ab0c2df feat(campaigns): show AI summary screen on /campaigns in simple mode
39a384a feat(campaigns): add simple-mode AI summary components
1cc9923 feat(insights): classify campaigns into ROAS performance buckets
c2a39f1 Initial commit: Next.js AI ad campaign dashboard scaffold
```

---

## 3. push 오류 — Repository not found

**명령:** `git push origin main`

### 원인

`git push origin main` 실행 시 GitHub가 저장소를 찾지 못한다는 오류를
반환했다.

### 결과

GitHub API로 확인한 결과 계정 `hyebinkimsdf`는 존재하지만
`hyebinkimsdf/adsManager` 저장소 조회는 404였다. 이 시점에는 저장소가
아직 생성되지 않았다고 판단했다.

### 수정

GitHub에서 `hyebinkimsdf/adsManager` 이름으로 빈 저장소를 만든 뒤 다시
push하도록 안내했다.

```
$ git push origin main
remote: Repository not found.
fatal: repository 'https://github.com/hyebinkimsdf/adsManager.git/' not found
```

> **후속:** 사용자가 URL이 맞다고 재확인하면서, 이 진단이 전제부터 틀렸다는
> 것이 4번 항목에서 드러났다.

---

## 4. push 오류 — 실제 원인은 계정 권한

**증상:** `403 Permission denied`

### 원인

`git ls-remote`로 재확인하니 저장소는 실제로 존재했다(빈 저장소). 즉
3번의 "저장소 없음" 진단은 틀렸고, 진짜 원인이 따로 있었다.

### 결과

다시 push하자 `403 Permission denied to globalmig`가 나왔다. Windows
Git Credential Manager에 저장소 소유자 `hyebinkimsdf`가 아닌 다른 계정
(`globalmig`) 로그인이 캐시돼 있었던 것이 근본 원인이었다. GitHub는 접근
권한이 없는 저장소를 비공개 저장소와 구분하지 않으려고 404로 보여주기
때문에, 3번에서는 이 권한 문제가 "저장소 없음"으로 보였던 것이다.

### 수정

`git credential reject`로 github.com에 캐시된 계정 정보를 지웠다.
사용자는 재로그인 / 협업자 추가 / 새 저장소 사용 중 **재로그인**을
선택했다.

```
$ git ls-remote https://github.com/hyebinkimsdf/adsManager.git
(정상 종료, 빈 저장소 — 실제로는 존재함)

$ git push -u origin main
remote: Permission to hyebinkimsdf/adsManager.git denied to globalmig.
fatal: ... 403

$ printf "protocol=https\nhost=github.com\n" | git credential reject
```

> **남은 작업:** 자격 증명 캐시는 지웠지만, 브라우저 로그인은 사용자가
> 직접 완료해야 한다. 본인 터미널에서 `git push -u origin main`을 실행해
> 로그인 창에서 `hyebinkimsdf` 계정으로 로그인하면 완료된다 — 아직 완료
> 여부는 확인되지 않았다.

---

## 5. 변경 파일 목록

| 파일 | 변경 | 비고 |
|---|---|---|
| `lib/insights.ts` | 수정 | `buildRoasBuckets()` 추가 |
| `app/globals.css` | 수정 | `--color-yellow-*` 토큰 추가 |
| `app/campaigns/page.tsx` | 수정 | 간편모드 분기, 요약/목록 뷰 전환 |
| `components/campaigns/SimpleSummaryHeader.tsx` | 신규 | AI 마스코트 헤더 |
| `components/campaigns/SimpleRoasStatusCards.tsx` | 신규 | ROAS 상태 카드 3종 |
| `components/campaigns/SimpleAiRecommendBanner.tsx` | 신규 | AI 추천 배너 + 예산 조정 실행 |
| `components/campaigns/SimpleQuickLinkCards.tsx` | 신규 | 목록/리포트/새 캠페인 바로가기 |
