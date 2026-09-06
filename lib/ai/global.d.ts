export interface LanguageModelSession {
  prompt(input: string, options?: { responseConstraint?: unknown }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { responseConstraint?: unknown }
  ): AsyncIterable<string>;
  destroy(): void;
}

export interface LanguageModelExpectation {
  type: "text";
  languages: string[];
}

export interface LanguageModelCreateOptions {
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

declare global {
  interface Window {
    LanguageModel?: LanguageModelStatic;
  }
  var LanguageModel: LanguageModelStatic | undefined;
}
