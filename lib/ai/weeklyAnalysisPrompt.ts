export const WEEKLY_ANALYSIS_SYSTEM_PROMPT = `당신은 광고주를 돕는 광고 운영 어시스턴트입니다. 주어진 캠페인의 최근 7일 성과 데이터를 분석해서, 지금 바로 실행하면 좋을 액션과 눈에 띄는 캠페인을 뽑아줍니다.

규칙:
1. 반드시 주어진 JSON 스키마 형식으로만 응답합니다. 스키마 밖의 텍스트를 추가하지 마세요.
2. campaignId는 반드시 제공된 캠페인 목록의 id 중 하나를 사용하세요. 목록에 없는 id를 만들어내지 마세요.
3. recommendations는 최대 3개, 서로 다른 campaignId를 고르세요.
   - kind가 "lower_budget"이면 최근 7일 ROAS가 낮거나 지출 대비 전환이 적은 캠페인을 고르세요.
   - kind가 "raise_budget"이면 ROAS가 높고 성과가 좋은 캠페인을 고르세요.
   - kind가 "focus_target"이면 전환이 가장 많이 발생한 캠페인을 고르세요.
   - percent는 -30에서 30 사이 정수만 제안하세요(lower_budget은 음수, raise_budget은 양수). 근거 없는 과감한 변경은 피하세요.
   - title은 한 문장으로 무엇을 할지, detail은 왜 그런지 실제 수치를 근거로 짧게 설명하세요.
4. spotlights는 최대 3개, recommendations와 무관하게 서로 다른 campaignId를 고르세요.
   - tag "best": 성과가 가장 좋은 캠페인 1개
   - tag "rising": 최근 전환 추세가 상승 중인 캠페인 최대 1개(없으면 생략)
   - tag "watch": 개선이 필요한 캠페인 최대 1개
   - reason은 한 문장으로, 실제 수치를 근거로 설명하세요.
5. 지출 이력이 없는(spend가 0인) 캠페인은 추천하지 마세요.`;

export interface WeeklyCampaignInput {
  id: string;
  name: string;
  dailyBudget: number;
  last7Spend: number;
  last7Conversions: number;
  last7Clicks: number;
  roas: number;
  conversionsTrendPercent: number;
  ageRange: string;
}

export function buildWeeklyAnalysisUserTurn(campaigns: WeeklyCampaignInput[]): string {
  const json = JSON.stringify(
    campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      dailyBudget: c.dailyBudget,
      last7Spend: c.last7Spend,
      last7Conversions: c.last7Conversions,
      last7Clicks: c.last7Clicks,
      roas: Number(c.roas.toFixed(1)),
      conversionsTrend: Number(c.conversionsTrendPercent.toFixed(1)),
      ageRange: c.ageRange,
    }))
  );
  return `[최근 7일 캠페인 현황]\n${json}\n\n위 데이터를 분석해서 recommendations와 spotlights를 만들어주세요.`;
}
