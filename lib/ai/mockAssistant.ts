import type { AssistantAction, AssistantReply, CampaignSnapshot } from "./types";
import { formatPercent } from "../format";
import { INDUSTRY_TAILS } from "./keywordHeuristics";

let actionCounter = 0;
function nextId(): string {
  actionCounter += 1;
  return `mock-action-${actionCounter}`;
}

function findCampaign(message: string, campaigns: CampaignSnapshot[]): CampaignSnapshot | undefined {
  const hit = campaigns.find((c) => message.includes(c.name));
  if (hit) return hit;
  return undefined;
}

function worstByRoas(campaigns: CampaignSnapshot[]): CampaignSnapshot | undefined {
  const active = campaigns.filter((c) => c.status === "active");
  if (active.length === 0) return undefined;
  return [...active].sort((a, b) => a.roas - b.roas)[0];
}

function bestByRoas(campaigns: CampaignSnapshot[]): CampaignSnapshot | undefined {
  const active = campaigns.filter((c) => c.status === "active");
  if (active.length === 0) return undefined;
  return [...active].sort((a, b) => b.roas - a.roas)[0];
}

function suggestKeywordsFor(campaign: CampaignSnapshot): string[] {
  const tails = INDUSTRY_TAILS[campaign.industry] ?? INDUSTRY_TAILS.etc;
  const candidates = [campaign.name, ...tails.map((tail) => `${campaign.name} ${tail}`)];
  return candidates.filter((k) => !campaign.keywords.includes(k)).slice(0, 4);
}

export function mockAssistantReply(message: string, campaigns: CampaignSnapshot[]): AssistantReply {
  const text = message.trim();
  const mentioned = findCampaign(text, campaigns);

  const wantsRaise = /(늘려|올려|증액|더 써|확대)/.test(text);
  const wantsLower = /(줄여|낮춰|감액|아껴|축소)/.test(text);
  const wantsPause = /(멈춰|중지|정지|꺼줘|일시정지)/.test(text);
  const wantsResume = /(재개|다시\s*시작|켜줘|다시\s*켜)/.test(text);
  const wantsSummary = /(성과|어때|요약|현황|리포트)/.test(text);
  const wantsTargeting = /(타겟|타겟팅|연령|성별|지역)/.test(text);
  const wantsKeywords = /(키워드)/.test(text);

  if (wantsRaise || wantsLower) {
    const target = mentioned ?? worstByRoas(campaigns) ?? campaigns[0];
    if (!target) {
      return { reply: "아직 등록된 캠페인이 없어요. 먼저 캠페인을 만들어볼까요?", actions: [] };
    }
    const percent = wantsRaise ? 15 : -15;
    const action: AssistantAction = {
      id: nextId(),
      type: "adjust_budget",
      label: `일 예산 ${percent > 0 ? "+15%" : "-15%"}`,
      description: `${target.name}의 일 예산을 ${formatPercent(Math.abs(percent), 0)} ${
        percent > 0 ? "늘려요" : "줄여요"
      }.`,
      campaignId: target.id,
      percent,
      riskLevel: "high",
    };
    return {
      reply: `${target.name}은 최근 ROAS ${formatPercent(target.roas, 0)} 흐름이에요. 예산을 ${
        percent > 0 ? "늘리는" : "줄이는"
      } 제안을 준비했어요. 아래에서 확인하고 적용해 주세요.`,
      actions: [action],
    };
  }

  if (wantsPause) {
    const target = mentioned ?? worstByRoas(campaigns);
    if (!target) {
      return { reply: "일시정지할 활성 캠페인을 찾지 못했어요. 캠페인 이름을 알려주시겠어요?", actions: [] };
    }
    return {
      reply: `${target.name}을 일시정지할까요? 지금 ROAS가 ${formatPercent(target.roas, 0)}로 낮은 편이라 예산 낭비를 막을 수 있어요.`,
      actions: [
        {
          id: nextId(),
          type: "pause_campaign",
          label: "캠페인 일시정지",
          description: `${target.name}을 일시정지 상태로 바꿔요.`,
          campaignId: target.id,
          riskLevel: "medium",
        },
      ],
    };
  }

  if (wantsResume) {
    const paused = campaigns.find((c) => c.status === "paused" && (!mentioned || c.id === mentioned.id));
    if (!paused) {
      return { reply: "지금 일시정지된 캠페인이 없어요.", actions: [] };
    }
    return {
      reply: `${paused.name}을 다시 시작할까요?`,
      actions: [
        {
          id: nextId(),
          type: "resume_campaign",
          label: "캠페인 재개",
          description: `${paused.name}을 다시 활성화해요.`,
          campaignId: paused.id,
          riskLevel: "low",
        },
      ],
    };
  }

  if (wantsKeywords) {
    const target = mentioned ?? campaigns[0];
    if (!target) return { reply: "키워드를 추가할 캠페인을 먼저 알려주세요.", actions: [] };
    const keywords = suggestKeywordsFor(target);
    if (keywords.length === 0) {
      return { reply: `${target.name}에는 이미 비슷한 키워드가 있어요. 다른 방향의 키워드를 원하시면 알려주세요.`, actions: [] };
    }
    return {
      reply: `${target.name}에 추가할 만한 키워드를 몇 개 준비했어요. 확인하고 적용해 주세요.`,
      actions: [
        {
          id: nextId(),
          type: "add_keywords",
          label: "키워드 추가",
          description: `${target.name}에 ${keywords.join(", ")} 키워드를 추가해요.`,
          campaignId: target.id,
          keywords,
          riskLevel: "low",
        },
      ],
    };
  }

  if (wantsTargeting) {
    const target = mentioned ?? campaigns[0];
    if (!target) return { reply: "타겟팅을 조정할 캠페인을 먼저 알려주세요.", actions: [] };
    return {
      reply: `${target.name}의 타겟팅을 바꾸고 싶으신 거죠? 어떤 연령대·성별로 조정할지 조금 더 구체적으로 알려주시면 바로 제안해 드릴게요. 예: "20대 여성으로 좁혀줘"`,
      actions: [],
    };
  }

  if (wantsSummary) {
    const best = bestByRoas(campaigns);
    const worst = worstByRoas(campaigns);
    if (!best || !worst) {
      return { reply: "아직 성과를 비교할 캠페인이 부족해요.", actions: [] };
    }
    const sameCampaign = best.id === worst.id;
    return {
      reply: sameCampaign
        ? `${best.name}이 ROAS ${formatPercent(best.roas, 0)}로 가장 활발해요. 다른 캠페인도 이 흐름을 참고해볼 만해요.`
        : `${best.name}이 ROAS ${formatPercent(best.roas, 0)}로 가장 좋고, ${worst.name}은 ${formatPercent(worst.roas, 0)}로 아쉬워요. 예산을 옮겨볼까요?`,
      actions: [],
    };
  }

  return {
    reply:
      "무엇을 도와드릴까요? '이번 주 성과 어때?', '예산 늘려줘', '캠페인 멈춰줘'처럼 편하게 말씀해 주세요.",
    actions: [],
  };
}
