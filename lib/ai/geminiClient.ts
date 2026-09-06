import { SYSTEM_PROMPT, buildUserTurn } from "./systemPrompt";
import { ASSISTANT_RESPONSE_SCHEMA } from "./schema";
import type { AssistantReply } from "./types";

const DEFAULT_MODEL = "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gemini의 responseSchema는 OpenAPI 3.0 서브셋이라 additionalProperties를 지원하지 않는다.
// Chrome/Edge Prompt API에 쓰는 ASSISTANT_RESPONSE_SCHEMA를 그대로 재사용하기 위해 제거해서 보낸다.
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node && typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>).filter(
      ([key]) => key !== "additionalProperties"
    );
    return Object.fromEntries(entries.map(([key, value]) => [key, toGeminiSchema(value)]));
  }
  return node;
}

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [400, 900];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(model: string, apiKey: string, body: unknown): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
    // 무료 티어에서 흔한 일시적 과부하(429/503)는 짧게 재시도한다.
    lastRes = res;
    if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
  }
  return lastRes!;
}

export async function generateGeminiReply(
  message: string,
  campaignsJson: string
): Promise<AssistantReply | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const res = await callGemini(model, apiKey, {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildUserTurn(message, campaignsJson) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(ASSISTANT_RESPONSE_SCHEMA),
    },
  });

  if (!res.ok) {
    throw new Error(`Gemini API 오류 (${res.status})`);
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const parsed = JSON.parse(text);
  if (parsed && typeof parsed.reply === "string" && Array.isArray(parsed.actions)) {
    return parsed as AssistantReply;
  }
  return null;
}
