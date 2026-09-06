"use client";

import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { theme } from "@/lib/theme/tokens";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>;
}
