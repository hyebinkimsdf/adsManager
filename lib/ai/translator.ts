import type { TranslatorSession } from "./global";

export type TranslatorAvailability = "unavailable" | "downloadable" | "downloading" | "available";

export async function checkTranslatorAvailability(
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslatorAvailability> {
  if (typeof window === "undefined" || !window.Translator) return "unavailable";
  try {
    return await window.Translator.availability({ sourceLanguage, targetLanguage });
  } catch {
    return "unavailable";
  }
}

export async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  onDownloadProgress?: (loaded: number) => void
): Promise<TranslatorSession | null> {
  if (typeof window === "undefined" || !window.Translator) return null;
  try {
    return await window.Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor: (monitor) => {
        monitor.addEventListener("downloadprogress", (event) => {
          const e = event as unknown as { loaded?: number };
          if (typeof e.loaded === "number") onDownloadProgress?.(e.loaded);
        });
      },
    });
  } catch {
    return null;
  }
}
