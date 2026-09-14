// 대량 캠페인 시드 데이터를 원격 D1에 넣기 위한 .sql 파일을 생성한다. DB에 직접 쓰지 않는다 —
// 실행 결과로 나온 .sql 파일을 `wrangler d1 execute --remote --file`로 별도 적용한다.
//
// 실행 예시:
//   node --require ./tests/register.cjs scripts/generate-seed-sql.ts --count=2000
//   node --require ./tests/register.cjs scripts/generate-seed-sql.ts \
//     --count=30 --owner=owner-user-01 --prefix=camp-u01- --out=seed-user-01.sql
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildHistory } from "@/lib/mock/campaigns";
import { OBJECTIVES, INDUSTRIES, STATUSES, GENDERS, MIN_DAILY_BUDGET, MAX_DAILY_BUDGET } from "@/lib/campaigns/validate";
import { INDUSTRY_LABEL } from "@/lib/mock/campaigns";
import { MY_OWNER_ID } from "@/lib/campaigns/owner";
import type { Targeting } from "@/lib/mock/types";

if (process.env.NODE_ENV === "production") {
  console.error("프로덕션 환경에서는 실행할 수 없습니다.");
  process.exit(1);
}

const ROWS_PER_INSERT = 20;
const REGIONS_POOL = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "전국"];
const INTERESTS_POOL = ["패션", "뷰티", "여행", "테크", "재테크", "육아", "반려동물", "운동", "맛집", "교육"];
const AGE_RANGES = ["18-29", "20-34", "25-44", "35-54", "전체"];
const DAY_MS = 24 * 60 * 60 * 1000;

function arg(name: string, fallback: string): string {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

function parseCount(): number {
  const count = Number(arg("count", "2000"));
  if (!Number.isInteger(count) || count <= 0 || count > 20000) {
    console.error("--count는 1~20000 사이 정수여야 합니다.");
    process.exit(1);
  }
  return count;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function buildTargeting(idx: number): Targeting {
  return {
    ageRange: AGE_RANGES[idx % AGE_RANGES.length],
    gender: GENDERS[idx % GENDERS.length],
    regions: [REGIONS_POOL[idx % REGIONS_POOL.length]],
    interests: [INTERESTS_POOL[idx % INTERESTS_POOL.length], INTERESTS_POOL[(idx + 3) % INTERESTS_POOL.length]],
  };
}

function buildRow(i: number, now: number, idPrefix: string, ownerId: string) {
  const idx = i - 1;
  const id = `${idPrefix}${pad(i, 6)}`;
  const objective = OBJECTIVES[idx % OBJECTIVES.length];
  const industry = INDUSTRIES[idx % INDUSTRIES.length];
  const status = STATUSES[idx % STATUSES.length];
  const name = `시드 캠페인 ${pad(i, 6)} · ${INDUSTRY_LABEL[industry]}`;

  const budgetSpan = MAX_DAILY_BUDGET - MIN_DAILY_BUDGET;
  const dailyBudget = MIN_DAILY_BUDGET + Math.round(((budgetSpan * ((idx * 977) % 5000)) / 5000 / 1000)) * 1000;

  const baseSpend = 20000 + ((idx * 613) % 180000);
  const trendValue = -0.3 + (((idx * 37) % 100) / 100) * 0.6; // -0.3 ~ 0.3
  const history = buildHistory(idx + 1, baseSpend, trendValue);

  // 기존 데모 시드보다 항상 과거가 되도록(홈 화면 "최근 캠페인" 미리보기에서 밀려나지 않게)
  // 60~360일 전 사이로 분산하고, idx*1000ms를 더 빼서 완전히 유일한 타임스탬프를 만든다.
  const daysAgo = 60 + (idx % 300);
  const createdAt = new Date(now - daysAgo * DAY_MS - idx * 1000).toISOString();

  const targeting = buildTargeting(idx);

  const values = [
    `'${id}'`,
    `'${escapeSql(name)}'`,
    `'display'`,
    `'${objective}'`,
    `'${industry}'`,
    `'${status}'`,
    String(dailyBudget),
    `'${escapeSql(JSON.stringify(targeting))}'`,
    `'${escapeSql(JSON.stringify(history))}'`,
    `'demo'`,
    `'${escapeSql(ownerId)}'`,
    `'${createdAt}'`,
    `'${createdAt}'`,
  ];
  return `(${values.join(", ")})`;
}

function main() {
  const count = parseCount();
  const ownerId = arg("owner", MY_OWNER_ID);
  const idPrefix = arg("prefix", "camp-seed-");
  const outName = arg("out", "seed-large.sql");
  const now = Date.now();

  const statements: string[] = [
    `-- 자동 생성된 시드 데이터 (scripts/generate-seed-sql.ts). ownerId=${ownerId}. 직접 수정하지 말고 스크립트를 다시 실행하세요.`,
  ];

  for (let start = 1; start <= count; start += ROWS_PER_INSERT) {
    const end = Math.min(start + ROWS_PER_INSERT - 1, count);
    const rows: string[] = [];
    for (let i = start; i <= end; i++) {
      rows.push(buildRow(i, now, idPrefix, ownerId));
    }
    statements.push(
      `INSERT INTO Campaign (id, name, adType, objective, industry, status, dailyBudget, targeting, history, metricSource, ownerId, createdAt, updatedAt)\nVALUES\n${rows.join(",\n")};`
    );
  }

  const outPath = join(__dirname, outName);
  writeFileSync(outPath, statements.join("\n\n") + "\n", "utf8");
  console.log(`${count}건 시드 SQL 생성 완료 (owner=${ownerId}, prefix=${idPrefix}): ${outPath}`);
}

main();
