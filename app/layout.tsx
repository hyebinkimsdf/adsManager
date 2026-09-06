import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "AI 광고 관리 대시보드",
  description: "브라우저 내장 AI와 대화하며 광고를 세팅하고 성과를 확인하는 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" style={{ height: "100%", WebkitFontSmoothing: "antialiased" }}>
      <body style={{ minHeight: "100%" }}>
        <QueryProvider>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
