import type { LanguageModelSession, TranslatorSession } from "./global";
import { waitForAi } from "./waitForAi";

export type AvailabilityState = "checking" | "idle" | "unsupported" | "downloadable" | "downloading" | "initializing" | "available" | "error";
export interface Translators {
  toEn: TranslatorSession;
  toKo: TranslatorSession;
}
export interface AiResourceStatus {
  id: string;
  label: string;
  state: AvailabilityState;
  progress: number;
}
export type AiExecutionStage = "preparing" | "session" | "translate-input" | "inference" | "parse" | "translate-output";
export type AiFailureReason = "unsupported" | "not-ready" | "session" | "timeout" | "invalid-response" | "failed" | "cancelled";
export interface AiExecutionStatus {
  requestId: number;
  featureId: string;
  label: string;
  stage: AiExecutionStage;
  outcome: "running" | "success" | "fallback" | "cancelled";
  durationMs: number;
  reason?: AiFailureReason;
}
interface Resource<T> extends AiResourceStatus {
  value: T | null;
  pending: Promise<boolean> | null;
  installed: boolean;
  /** 대화형 세션이 마지막으로 반영한 컨텍스트 신호와, 그 뒤로 다시 보내지 않은 턴 수. */
  contextSignature: string | null;
  turnsSinceContext: number;
}
interface AiSnapshot {
  /** 기본 상태는 대화와 번역기만 기준으로 한다. */
  state: AvailabilityState;
  downloadProgress: number;
  resources: AiResourceStatus[];
  features: (AiResourceStatus & { active: boolean })[];
  executions: AiExecutionStatus[];
}
type Trigger = "automatic" | "request" | "route" | "activation";

const EN_TEXT = { type: "text" as const, languages: ["en"] };
const EN_OPTIONS = { expectedInputs: [EN_TEXT], expectedOutputs: [EN_TEXT] };
const INITIAL_SNAPSHOT: AiSnapshot = { state: "checking", downloadProgress: 0, resources: [], features: [], executions: [] };
const PREPARATION_WAIT_MS = 15000;

function resource<T>(id: string, label: string): Resource<T> {
  return {
    id, label, state: "checking", progress: 0, value: null, pending: null, installed: false,
    contextSignature: null, turnsSinceContext: 0,
  };
}

function combinedState(resources: AiResourceStatus[]): AvailabilityState {
  // 한 의존성이 실패했으면 다른 자원이 준비 중이어도 해당 기능에서 재시도할 수 있다.
  const priority: AvailabilityState[] = ["unsupported", "error", "downloadable", "checking", "downloading", "initializing", "idle", "available"];
  return priority.find((state) => resources.some((item) => item.state === state)) ?? "unsupported";
}

/** Provider 수명의 실행 객체를 공유한다. 모델 파일 저장은 Chrome이 관리한다. */
export class OnDeviceAiRuntime {
  private models: Map<string, Resource<LanguageModelSession>>;
  private toEn = resource<TranslatorSession>("ko-en", "한국어 → 영어");
  private toKo = resource<TranslatorSession>("en-ko", "영어 → 한국어");
  private snapshot = INITIAL_SNAPSHOT;
  private listeners = new Set<() => void>();
  private lifetime: AbortController | null = null;
  private checking: Promise<void> | null = null;
  private starting: Promise<void> | null = null;
  private activeFeature: string | null = null;
  private taskSessions = new Map<LanguageModelSession, () => void>();
  private runId = 0;
  private startedAt = 0;
  private executionId = 0;
  private executions = new Map<string, AiExecutionStatus>();

  constructor(systemPrompts: readonly string[]) {
    this.models = new Map(systemPrompts.map((prompt, index) => [
      prompt, resource<LanguageModelSession>(`model-${index}`, ["대화 AI", "캠페인 초안 AI", "추적 규칙 AI"][index] ?? "AI"),
    ]));
  }

  private log(message: string, details: Record<string, unknown> = {}) {
    console.info(`[on-device-ai][run:${this.runId}] ${message}`, {
      elapsedMs: Math.round(performance.now() - this.startedAt), ...details,
    });
  }

  getSnapshot = (): AiSnapshot => this.snapshot;
  getServerSnapshot = (): AiSnapshot => INITIAL_SNAPSHOT;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getFeatureStatus = (systemPrompt: string) => {
    const model = this.models.get(systemPrompt);
    return this.snapshot.features.find((feature) => feature.id === model?.id);
  };

  /** 입력·답변·캠페인 정보 없이 실행 단계와 소요 시간만 보관한다. */
  beginExecution = (systemPrompt: string) => {
    const feature = this.models.get(systemPrompt);
    const requestId = ++this.executionId;
    if (!feature) return requestId;
    this.executions.set(feature.id, {
      requestId, featureId: feature.id, label: feature.label,
      stage: "preparing", outcome: "running", durationMs: 0,
    });
    this.publish();
    return requestId;
  };

  updateExecution = (requestId: number, update: Pick<AiExecutionStatus, "stage" | "outcome" | "durationMs"> & { reason?: AiFailureReason }) => {
    const entry = [...this.executions.values()].find((execution) => execution.requestId === requestId);
    // 끝난 요청이나 이전 Provider의 늦은 결과는 현재 화면 상태를 덮지 않는다.
    if (!entry || entry.outcome !== "running") return;
    const next = { ...entry, ...update };
    this.executions.set(entry.featureId, next);
    this.log("요청 처리 상태", { ...next, previousStage: entry.stage, stageDurationMs: Math.max(0, next.durationMs - entry.durationMs) });
    this.publish();
  };

  private resources() {
    return [...this.models.values(), this.toEn, this.toKo];
  }

  private publish() {
    const resources = this.resources().map(({ id, label, state, progress }) => ({ id, label, state, progress }));
    const features = Array.from(this.models, ([prompt, model], index) => {
      const dependencies = [model, this.toEn, this.toKo];
      return {
        id: model.id, label: model.label, state: combinedState(dependencies),
        active: index === 0 || prompt === this.activeFeature,
        progress: Math.round(dependencies.reduce((sum, item) => sum + item.progress, 0) / dependencies.length),
      };
    });
    for (const feature of features) {
      const before = this.snapshot.features.find((item) => item.id === feature.id)?.state ?? "checking";
      if (before !== feature.state) this.log("기능 준비 상태 변경", { feature: feature.label, from: before, to: feature.state });
    }
    this.snapshot = {
      state: features[0]?.state ?? "unsupported",
      // 준비 진행률의 평균이며 실제 다운로드 바이트 비율은 아니다.
      downloadProgress: features[0]?.progress ?? 0, resources, features,
      executions: [...this.executions.values()],
    };
    this.listeners.forEach((listener) => listener());
  }

  start = (): Promise<void> => {
    if (this.lifetime) return this.starting ?? Promise.resolve();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.runId += 1;
    this.startedAt = performance.now();
    this.log("Provider 준비 시작", {
      languageModelApi: typeof window !== "undefined" && !!window.LanguageModel,
      translatorApi: typeof window !== "undefined" && !!window.Translator,
    });
    this.checking = this.checkAvailability(lifetime);
    this.starting = this.checking.then(async () => {
      if (lifetime.signal.aborted) return;
      this.checking = null;
      if (this.snapshot.state !== "unsupported" && this.snapshot.state !== "error") await this.prepare("automatic");
    });
    return this.starting;
  };

  private async checkAvailability(lifetime: AbortController) {
    if (typeof window === "undefined" || !window.LanguageModel || !window.Translator) {
      this.resources().forEach((item) => { item.state = "unsupported"; });
      this.publish();
      return;
    }
    try {
      const [model, toEn, toKo] = await waitForAi(Promise.all([
        window.LanguageModel.availability(EN_OPTIONS),
        window.Translator.availability({ sourceLanguage: "ko", targetLanguage: "en" }),
        window.Translator.availability({ sourceLanguage: "en", targetLanguage: "ko" }),
      ]), { signal: lifetime.signal, timeoutMs: PREPARATION_WAIT_MS });
      if (lifetime.signal.aborted) return;
      this.log("브라우저 availability 확인", { model, koToEn: toEn, enToKo: toKo });
      for (const item of this.resources()) {
        const availability = item === this.toEn ? toEn : item === this.toKo ? toKo : model;
        item.installed = availability === "available";
        item.state = availability === "unavailable" ? "unsupported" : availability === "available" ? "idle" : availability;
        item.progress = item.installed ? 100 : 0;
      }
    } catch (error) {
      if (lifetime.signal.aborted) return;
      console.warn("[on-device-ai] 지원 상태 확인 실패", error);
      this.resources().forEach((item) => { item.state = "error"; });
    }
    this.publish();
  }

  /** 기본 준비는 대화만 기다린다. 다른 기능은 별도 준비 상태를 가진다. */
  prepare = (trigger: Trigger = "request"): Promise<boolean> => {
    const primary = this.models.keys().next().value;
    return primary ? this.prepareFeature(primary, trigger) : Promise.resolve(false);
  };

  prepareFeatureById = (id: string): Promise<boolean> => {
    const entry = Array.from(this.models).find(([, model]) => model.id === id);
    return entry ? this.prepareFeature(entry[0]) : Promise.resolve(false);
  };

  /** 해당 화면에서 사용할 기능만 준비한다. 화면을 나가도 준비된 기본 세션은 재사용한다. */
  setActiveFeature = (systemPrompt: string | null): void => {
    const next = systemPrompt && this.models.has(systemPrompt) ? systemPrompt : null;
    if (next === this.activeFeature) return;
    this.activeFeature = next;
    this.publish();
    if (next) {
      this.log("화면 진입 사전 준비", { feature: this.models.get(next)?.label });
      void this.prepareFeature(next, "route");
    }
  };

  /** 대화·현재 화면의 기능만 재시도한다. 방문하지 않은 기능은 사용자 제스처로도 깨우지 않는다. */
  retryStalled = (): void => {
    for (const [prompt, model] of this.models) {
      if (prompt !== this.models.keys().next().value && prompt !== this.activeFeature) continue;
      if ([model, this.toEn, this.toKo].some((item) => item.state === "downloadable" && !item.pending)) {
        void this.prepareFeature(prompt, "activation");
      }
    }
  };

  /**
   * 대화형 세션은 문맥을 유지하므로, 매 턴 같은 컨텍스트(예: 캠페인 목록)를 반복해서 보내지
   * 않고 바뀌었거나 일정 턴이 지났을 때만 다시 보낸다. 작은 온디바이스 모델은 오래된 내용을
   * 놓칠 수 있어, 변경이 없어도 maxTurnsWithoutRefresh턴마다 한 번은 다시 보낸다.
   */
  shouldRefreshContext = (systemPrompt: string, signature: string, maxTurnsWithoutRefresh: number): boolean => {
    const model = this.models.get(systemPrompt);
    if (!model) return true;
    return model.contextSignature !== signature || model.turnsSinceContext >= maxTurnsWithoutRefresh;
  };

  /** 이번 턴에 실제로 컨텍스트를 다시 보냈는지 반영한다. */
  recordContextTurn = (systemPrompt: string, signature: string, refreshed: boolean): void => {
    const model = this.models.get(systemPrompt);
    if (!model) return;
    if (refreshed) { model.contextSignature = signature; model.turnsSinceContext = 0; }
    else model.turnsSinceContext += 1;
  };

  invalidateContext = (systemPrompt: string): void => {
    const model = this.models.get(systemPrompt);
    if (model) { model.contextSignature = null; model.turnsSinceContext = 0; }
  };

  prepareFeature = (systemPrompt: string, trigger: Trigger = "request"): Promise<boolean> => {
    const lifetime = this.lifetime;
    const model = this.models.get(systemPrompt);
    if (!lifetime || lifetime.signal.aborted || !model) return Promise.resolve(false);
    if (trigger === "route" && systemPrompt !== this.activeFeature) return Promise.resolve(false);
    if (this.checking) {
      return this.checking.then(() => lifetime.signal.aborted ? false : this.prepareFeature(systemPrompt, trigger));
    }
    if (!window.LanguageModel || !window.Translator) return Promise.resolve(false);
    const dependencies = [model, this.toEn, this.toKo];
    if (dependencies.some((item) => item.state === "unsupported")) return Promise.resolve(false);
    if (dependencies.every((item) => item.value)) {
      this.log("준비된 세션·번역기 재사용", { feature: model.label, trigger });
      return Promise.resolve(true);
    }
    this.log("기능 준비 시도", {
      feature: model.label, trigger,
      userActivation: typeof navigator !== "undefined" ? navigator.userActivation?.isActive ?? null : null,
      reuse: dependencies.filter((item) => item.value).map((item) => item.label),
      join: dependencies.filter((item) => item.pending).map((item) => item.label),
      create: dependencies.filter((item) => !item.value && !item.pending).map((item) => item.label),
    });
    const modelApi = window.LanguageModel;
    const translatorApi = window.Translator;
    // 필요한 세 자원의 create()를 사용자 활성화가 유지되는 같은 호출에서 시작한다.
    const tasks = [
      this.ensureResource(model, lifetime, (monitor) => modelApi.create({
        ...EN_OPTIONS, initialPrompts: [{ role: "system", content: systemPrompt }], monitor, signal: lifetime.signal,
      })),
      this.ensureResource(this.toEn, lifetime, (monitor) => translatorApi.create({
        sourceLanguage: "ko", targetLanguage: "en", monitor, signal: lifetime.signal,
      })),
      this.ensureResource(this.toKo, lifetime, (monitor) => translatorApi.create({
        sourceLanguage: "en", targetLanguage: "ko", monitor, signal: lifetime.signal,
      })),
    ];
    this.publish();
    return Promise.all(tasks).then((results) => {
      if (lifetime.signal.aborted) return false;
      const ready = results.every(Boolean);
      this.log("기능 준비 시도 종료", { feature: model.label, ready });
      return ready;
    });
  };

  private ensureResource<T extends { destroy(): void }>(
    item: Resource<T>, lifetime: AbortController,
    factory: (monitor: (target: EventTarget) => void) => Promise<T>
  ): Promise<boolean> {
    if (item.value) return Promise.resolve(true);
    if (item.pending) return item.pending;
    const startedAt = performance.now();
    let lastProgressBucket = -1;
    this.log("세션 생성 시작", { resource: item.label, previousState: item.state });
    item.state = "initializing";
    const monitor = (target: EventTarget) => {
      target.addEventListener("downloadprogress", (event) => {
        if (lifetime.signal.aborted) return;
        const loaded = (event as Event & { loaded?: number }).loaded;
        if (typeof loaded !== "number" || !Number.isFinite(loaded)) return;
        item.progress = Math.max(item.progress, Math.round(Math.max(0, Math.min(1, loaded)) * 100));
        item.state = item.installed || item.progress === 100 ? "initializing" : "downloading";
        const bucket = Math.floor(item.progress / 10);
        if (bucket !== lastProgressBucket) {
          lastProgressBucket = bucket;
          this.log("모델 준비 진행 이벤트", { resource: item.label, progress: item.progress, state: item.state });
        }
        this.publish();
      });
    };
    const pending = (async () => {
      try {
        const value = await factory(monitor);
        if (lifetime.signal.aborted) { value.destroy(); return false; }
        item.value = value;
        item.installed = true;
        item.progress = 100;
        item.state = "available";
        this.log("자원 준비 완료", { resource: item.label, durationMs: Math.round(performance.now() - startedAt) });
        return true;
      } catch (error) {
        if (lifetime.signal.aborted) return false;
        const name = error instanceof Error ? error.name : "";
        item.state = name === "NotAllowedError" ? "downloadable" : "error";
        this.log("자원 준비 중단", { resource: item.label, errorName: name, nextState: item.state });
        console.warn(`[on-device-ai] ${item.label} 준비 실패`, error);
        return false;
      } finally {
        if (!lifetime.signal.aborted) this.publish();
      }
    })();
    item.pending = pending;
    void pending.then(() => { if (item.pending === pending) item.pending = null; });
    return pending;
  }

  waitForFeature = async (systemPrompt: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<boolean> => {
    if (options.signal?.aborted) return false;
    const lifetime = this.lifetime;
    if (!lifetime) return false;
    const signal = options.signal ? AbortSignal.any([options.signal, lifetime.signal]) : lifetime.signal;
    try {
      return await waitForAi(this.prepareFeature(systemPrompt), { signal, timeoutMs: options.timeoutMs ?? PREPARATION_WAIT_MS });
    } catch (error) {
      if (!lifetime.signal.aborted) this.log("개별 요청 준비 대기 종료", {
        feature: this.models.get(systemPrompt)?.label, reason: error instanceof Error ? error.name : "error",
      });
      return false;
    }
  };

  getSession = (systemPrompt: string) => this.models.get(systemPrompt)?.value ?? null;
  getTranslators = (): Translators | null => this.toEn.value && this.toKo.value ? { toEn: this.toEn.value, toKo: this.toKo.value } : null;

  /** 일회성 작업은 프롬프트만 가진 기본 세션에서 복제한다. 기본 세션에는 요청을 보내지 않는다. */
  createTaskSession = async (systemPrompt: string, requestSignal: AbortSignal): Promise<LanguageModelSession | null> => {
    const base = this.getSession(systemPrompt);
    const lifetime = this.lifetime;
    if (!base || !lifetime || requestSignal.aborted || lifetime.signal.aborted) return null;
    const signal = AbortSignal.any([requestSignal, lifetime.signal]);
    try {
      const creating = base.clone ? base.clone({ signal }) : window.LanguageModel!.create({
        ...EN_OPTIONS, initialPrompts: [{ role: "system", content: systemPrompt }], signal,
      });
      // abort를 무시하는 구현에서도 늦게 도착한 결과는 등록하지 않고 폐기한다.
      const owned = creating.then((session) => {
        if (signal.aborted) { session.destroy(); return null; }
        const release = () => {
          signal.removeEventListener("abort", release);
          this.taskSessions.delete(session);
          session.destroy();
        };
        this.taskSessions.set(session, release);
        signal.addEventListener("abort", release, { once: true });
        this.log("일회성 작업 세션 준비 완료", { feature: this.models.get(systemPrompt)?.label, cloned: !!base.clone });
        return session;
      });
      return await waitForAi(owned, { signal, timeoutMs: PREPARATION_WAIT_MS });
    } catch (error) {
      if (!signal.aborted) this.log("일회성 세션 준비 실패", { reason: error instanceof Error ? error.name : "error" });
      return null;
    }
  };

  releaseTaskSession = (session: LanguageModelSession) => { this.taskSessions.get(session)?.(); };

  dispose = () => {
    if (this.lifetime) this.log("Provider 종료·자원 해제", {
      released: this.resources().filter((item) => item.value).map((item) => item.label),
      pending: this.resources().filter((item) => item.pending).map((item) => item.label),
    });
    this.lifetime?.abort();
    this.lifetime = null;
    this.checking = null;
    this.starting = null;
    this.activeFeature = null;
    this.executions.clear();
    this.taskSessions.forEach((release) => release());
    for (const item of this.resources()) {
      item.value?.destroy();
      item.value = null;
      item.pending = null;
      item.state = "checking";
      item.progress = 0;
      item.installed = false;
      item.contextSignature = null;
      item.turnsSinceContext = 0;
    }
    this.snapshot = INITIAL_SNAPSHOT;
  };
}
