/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { useUiMode, setUiMode } from "@/lib/ui/mode";

const menuItemStyle = (active: boolean) => css`
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-size: 13px;
  color: ${active ? "var(--color-blue-600)" : "var(--color-gray-700)"};
  font-weight: ${active ? 600 : 400};

  ${!active &&
  `
    &:hover {
      background-color: var(--color-gray-50);
    }
  `}
`;

export function AccountModeMenu() {
  const mode = useUiMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} css={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        css={css`
          display: flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: 9999px;
          border: 1px solid var(--border-subtle);
          background: white;
          padding: 0.25rem 0.625rem;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-gray-700);

          &:hover {
            border-color: var(--color-blue-500);
          }
        `}
      >
        {mode === "simple" ? "간편" : "전문가"}
        <HiChevronDown style={{ height: "0.875rem", width: "0.875rem" }} aria-hidden="true" />
      </button>
      {open && (
        <div
          css={css`
            position: absolute;
            bottom: 100%;
            left: 0;
            z-index: 10;
            margin-bottom: 0.375rem;
            width: 8rem;
            overflow: hidden;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-subtle);
            background: white;
            padding: 0.25rem 0;
            box-shadow: var(--shadow-float);
          `}
        >
          <button
            type="button"
            onClick={() => {
              setUiMode("simple");
              setOpen(false);
            }}
            css={menuItemStyle(mode === "simple")}
          >
            🙂 간편 모드
          </button>
          <button
            type="button"
            onClick={() => {
              setUiMode("expert");
              setOpen(false);
            }}
            css={menuItemStyle(mode === "expert")}
          >
            ⚙️ 전문가 모드
          </button>
        </div>
      )}
    </div>
  );
}
