/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import type { IconType } from "react-icons";
import { HiCheckCircle } from "react-icons/hi2";
import { Badge } from "@/components/ui/Badge";

export function OptionGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: 2 | 3 }) {
  return (
    <div
      css={css`
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        @media (min-width: 480px) {
          grid-template-columns: repeat(${columns}, 1fr);
        }
      `}
    >
      {children}
    </div>
  );
}

export function OptionCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  desc,
  badge,
  active = false,
  onClick,
}: {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  label: string;
  desc?: React.ReactNode;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      css={css`
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.625rem;
        border-radius: var(--radius-lg);
        border: 1.5px solid ${active ? "var(--color-blue-500)" : "var(--border-subtle)"};
        background-color: ${active ? "var(--color-blue-50)" : "white"};
        padding: 1.5rem 1rem;
        text-align: center;
        transition: border-color 150ms, background-color 150ms, box-shadow 150ms;

        &:hover {
          border-color: var(--color-blue-500);
          box-shadow: var(--shadow-card);
        }
      `}
    >
      {active && (
        <HiCheckCircle
          style={{ position: "absolute", top: "0.625rem", right: "0.625rem", height: "1.125rem", width: "1.125rem", color: "var(--color-blue-500)" }}
          aria-hidden="true"
        />
      )}
      {badge && (
        <span css={{ position: "absolute", top: "0.625rem", left: "0.625rem" }}>
          <Badge tone="blue">{badge}</Badge>
        </span>
      )}
      <span
        css={{
          display: "flex",
          height: "3.25rem",
          width: "3.25rem",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          backgroundColor: iconBg,
        }}
      >
        <Icon style={{ height: "1.625rem", width: "1.625rem", color: iconColor }} aria-hidden="true" />
      </span>
      <span css={{ fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>{label}</span>
      {desc && <span css={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-gray-600)" }}>{desc}</span>}
    </button>
  );
}
