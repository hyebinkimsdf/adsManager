export interface LanguageModelSession {
  prompt(input: string, options?: { responseConstraint?: unknown }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { responseConstraint?: unknown }
  ): AsyncIterable<string>;
  destroy(): void;
}

export interface LanguageModelCreateOptions {
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  topK?: number;
  monitor?: (monitor: EventTarget) => void;
}

export interface LanguageModelStatic {
  availability(): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelStatic;
  }
  var LanguageModel: LanguageModelStatic | undefined;
}
