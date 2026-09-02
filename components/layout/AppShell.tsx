"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiOutlineHome, HiOutlineMegaphone, HiOutlinePlus, HiSparkles } from "react-icons/hi2";
import { cn } from "@/lib/cn";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { AccountModeMenu } from "@/components/layout/AccountModeMenu";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: HiOutlineHome },
  { href: "/campaigns", label: "캠페인", icon: HiOutlineMegaphone },
  { href: "/campaigns/new", label: "새 캠페인", icon: HiOutlinePlus },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--border-subtle)] bg-white px-4 py-6 md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-blue-500)] text-white">
            <HiSparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[16px] font-bold text-[var(--color-gray-900)]">AI 광고 관리자</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
                    : "text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]"
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 pt-6">
          <p className="mb-2 text-[11px] font-medium text-[var(--color-gray-400)]">내 계정</p>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-gray-900)] text-[13px] font-bold text-white">
              N
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--color-gray-900)]">
              김혜빈
            </span>
            <AccountModeMenu />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border-subtle)] bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--color-blue-500)] text-white">
            <HiSparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-bold text-[var(--color-gray-900)]">AI 광고 관리자</span>
        </div>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-[var(--radius-full)] px-3 py-1.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--color-blue-50)] text-[var(--color-blue-600)]"
                    : "text-[var(--color-gray-500)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex justify-center border-b border-[var(--border-subtle)] bg-white px-4 py-2 md:hidden">
        <ModeToggle />
      </div>

      <main className="flex-1 bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>

      <AssistantDock />
    </div>
  );
}
