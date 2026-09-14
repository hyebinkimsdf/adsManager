export interface LanguageModelSession {
  clone?(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  prompt(input: string, options?: { responseConstraint?: unknown; signal?: AbortSignal }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { responseConstraint?: unknown; signal?: AbortSignal }
  ): AsyncIterable<string>;
  destroy(): void;
}

export interface LanguageModelExpectation {
  type: "text";
  languages: string[];
}

export interface LanguageModelCreateOptions {
  signal?: AbortSignal;
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  expectedInputs?: LanguageModelExpectation[];
  expectedOutputs?: LanguageModelExpectation[];
  temperature?: number;
  topK?: number;
  monitor?: (monitor: EventTarget) => void;
}

export interface LanguageModelAvailabilityOptions {
  expectedInputs?: LanguageModelExpectation[];
  expectedOutputs?: LanguageModelExpectation[];
}

export interface LanguageModelStatic {
  availability(
    options?: LanguageModelAvailabilityOptions
  ): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

export interface TranslatorSession {
  translate(text: string): Promise<string>;
  destroy(): void;
}

export interface TranslatorCreateOptions {
  signal?: AbortSignal;
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: EventTarget) => void;
}

export interface TranslatorAvailabilityOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslatorStatic {
  availability(
    options: TranslatorAvailabilityOptions
  ): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(options: TranslatorCreateOptions): Promise<TranslatorSession>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelStatic;
    Translator?: TranslatorStatic;
  }
  var LanguageModel: LanguageModelStatic | undefined;
  var Translator: TranslatorStatic | undefined;
}
