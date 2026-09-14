import type { LanguageModelSession } from "./global";
import type { AiExecutionStage, AiFailureReason, OnDeviceAiRuntime, Translators } from "./onDeviceAiRuntime";
import { waitForAi } from "./waitForAi";

export interface OnDeviceAiConfig<TInput, TEnglishOutput, TOutput> {
  logTag: string;
  systemPromptEn: string;
  responseSchemaEn: unknown;
  buildUserTurnEn: (englishInput: TInput, includeFullContext: boolean) => string;
  translateRequest: (input: TInput, translators: Translators) => Promise<TInput>;
  parseResponse: (raw: string, input: TInput) => TEnglishOutput | null;
  translateResponse: (parsedEn: TEnglishOutput, translators: Translators) => Promise<TOutput>;
  /** 번역·추론 제한 시간. 공유 모델의 준비 대기는 별도로 제한한다. */
  timeoutMs?: number;
  /** 화면의 대화 기록을 명시하는 채팅도 기본값인 독립 세션을 쓴다. */
  sessionMode?: "conversation" | "task";
  contextRefresh?: { signature: (input: TInput) => string; maxTurnsWithoutRefresh: number };
}

/** 번역·추론·실패 처리를 React 밖에서도 검증할 수 있는 요청 실행 함수. */
export async function runOnDeviceRequest<TInput, TEnglishOutput, TOutput>(
  runtime: OnDeviceAiRuntime,
  config: OnDeviceAiConfig<TInput, TEnglishOutput, TOutput>,
  input: TInput,
  controller: AbortController,
): Promise<TOutput | null> {
  const requestId = runtime.beginExecution(config.systemPromptEn);
  const startedAt = performance.now();
  let stage: AiExecutionStage = "preparing";
  let taskSession: LanguageModelSession | null = null;
  let finished = false;
  const report = (outcome: "running" | "success" | "fallback" | "cancelled", reason?: AiFailureReason) => {
    if (finished) return;
    runtime.updateExecution(requestId, { stage, outcome, reason, durationMs: Math.round(performance.now() - startedAt) });
    if (outcome !== "running") finished = true;
  };
  const move = (next: AiExecutionStage) => { stage = next; report("running"); };
  const fallback = (reason: AiFailureReason) => {
    if (config.sessionMode === "conversation") runtime.invalidateContext(config.systemPromptEn);
    report("fallback", reason);
    return null;
  };
  try {
    const ready = await runtime.waitForFeature(config.systemPromptEn, { signal: controller.signal });
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!ready) return fallback(runtime.getFeatureStatus(config.systemPromptEn)?.state === "unsupported" ? "unsupported" : "not-ready");
    const translators = runtime.getTranslators();
    if (!translators) return fallback("not-ready");
    move("session");
    const session = config.sessionMode === "conversation"
      ? runtime.getSession(config.systemPromptEn)
      : (taskSession = await runtime.createTaskSession(config.systemPromptEn, controller.signal));
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!session) return fallback("session");

    const attempt = async (): Promise<TOutput | null> => {
      move("translate-input");
      const englishInput = await config.translateRequest(input, translators);
      controller.signal.throwIfAborted();
      const signature = config.contextRefresh?.signature(input);
      // 독립 세션에는 이전 요청의 컨텍스트 기록을 적용하지 않는다.
      const refresh = config.sessionMode === "conversation" ? config.contextRefresh : undefined;
      const includeFullContext = !refresh || signature === undefined || runtime.shouldRefreshContext(config.systemPromptEn, signature, refresh.maxTurnsWithoutRefresh);
      move("inference");
      const raw = await session.prompt(config.buildUserTurnEn(englishInput, includeFullContext), {
        responseConstraint: config.responseSchemaEn, signal: controller.signal,
      });
      if (refresh && signature !== undefined && !finished) runtime.recordContextTurn(config.systemPromptEn, signature, includeFullContext);
      controller.signal.throwIfAborted();
      move("parse");
      const parsed = config.parseResponse(raw, input);
      if (parsed === null) return fallback("invalid-response");
      move("translate-output");
      const result = await config.translateResponse(parsed, translators);
      controller.signal.throwIfAborted();
      return result;
    };
    const result = await waitForAi(attempt(), { signal: controller.signal, timeoutMs: config.timeoutMs ?? 9000 });
    if (result !== null) report("success");
    return result;
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    if (config.sessionMode === "conversation") runtime.invalidateContext(config.systemPromptEn);
    if (name === "AbortError") { report("cancelled", "cancelled"); return null; }
    return fallback(name === "TimeoutError" ? "timeout" : "failed");
  } finally {
    // 시간 초과 뒤의 늦은 답변은 폐기하고 공유 준비는 계속 진행한다.
    controller.abort();
    if (taskSession) runtime.releaseTaskSession(taskSession);
  }
}
