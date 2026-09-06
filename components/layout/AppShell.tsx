/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiOutlineHome, HiOutlineMegaphone, HiOutlinePlus, HiSparkles } from "react-icons/hi2";
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

const navLinkStyle = (active: boolean) => css`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: var(--radius-sm);
  padding: 0.625rem 0.75rem;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 150ms, color 150ms;
  background-color: ${active ? "var(--color-blue-50)" : "transparent"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-600)"};

  ${!active &&
  `
    &:hover {
      background-color: var(--color-gray-50);
    }
  `}
`;

const mobileNavLinkStyle = (active: boolean) => css`
  border-radius: 9999px;
  padding: 0.375rem 0.75rem;
  font-size: 13px;
  font-weight: 500;
  background-color: ${active ? "var(--color-blue-50)" : "transparent"};
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-500)"};
`;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      css={css`
        display: flex;
        min-height: 100dvh;
        flex-direction: column;
        @media (min-width: 768px) {
          flex-direction: row;
        }
      `}
    >
      <aside
        css={css`
          display: none;
          width: 15rem;
          flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          background: white;
          padding: 1.5rem 1rem;
          @media (min-width: 768px) {
            display: flex;
            flex-direction: column;
          }
        `}
      >
        <div css={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.5rem" }}>
          <span
            css={css`
              display: flex;
              height: 2rem;
              width: 2rem;
              align-items: center;
              justify-content: center;
              border-radius: 10px;
              background-color: var(--color-blue-500);
              color: white;
            `}
          >
            <HiSparkles style={{ height: "1rem", width: "1rem" }} aria-hidden="true" />
          </span>
          <span css={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}>AI 광고 관리자</span>
        </div>
        <nav css={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} css={navLinkStyle(active)}>
                <Icon style={{ height: "1.125rem", width: "1.125rem" }} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div css={{ marginTop: "auto", padding: "0 0.5rem", paddingTop: "1.5rem" }}>
          <p css={{ marginBottom: "0.5rem", fontSize: 11, fontWeight: 500, color: "var(--color-gray-400)" }}>내 계정</p>
          <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              css={css`
                display: flex;
                height: 2rem;
                width: 2rem;
                flex-shrink: 0;
                align-items: center;
                justify-content: center;
                border-radius: 9999px;
                background-color: var(--color-gray-900);
                font-size: 13px;
                font-weight: 700;
                color: white;
              `}
            >
              N
            </span>
            <span
              css={css`
                min-width: 0;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
                font-weight: 600;
                color: var(--color-gray-900);
              `}
            >
              김혜빈
            </span>
            <AccountModeMenu />
          </div>
        </div>
      </aside>

      <header
        css={css`
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-subtle);
          background-color: rgba(255, 255, 255, 0.9);
          padding: 0.75rem 1rem;
          backdrop-filter: blur(8px);
          @media (min-width: 768px) {
            display: none;
          }
        `}
      >
        <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            css={css`
              display: flex;
              height: 1.75rem;
              width: 1.75rem;
              align-items: center;
              justify-content: center;
              border-radius: 8px;
              background-color: var(--color-blue-500);
              color: white;
            `}
          >
            <HiSparkles style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
          </span>
          <span css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>AI 광고 관리자</span>
        </div>
        <nav css={{ display: "flex", gap: "0.25rem" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} css={mobileNavLinkStyle(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div
        css={css`
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--border-subtle);
          background: white;
          padding: 0.5rem 1rem;
          @media (min-width: 768px) {
            display: none;
          }
        `}
      >
        <ModeToggle />
      </div>

      <main css={{ flex: 1, backgroundColor: "var(--surface-muted)" }}>
        <div
          css={css`
            margin: 0 auto;
            max-width: 64rem;
            padding: 1.5rem 1rem;
            @media (min-width: 640px) {
              padding: 2rem 1.5rem;
            }
          `}
        >
          {children}
        </div>
      </main>

      <AssistantDock />
    </div>
  );
}
