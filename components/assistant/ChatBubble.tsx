/** @jsxImportSource @emotion/react */
"use client";

import { css, keyframes } from "@emotion/react";
import { HiPencil } from "react-icons/hi2";

const bubbleBase = css`
  max-width: 85%;
  white-space: pre-wrap;
  border-radius: var(--radius-md);
  padding: 0.625rem 1rem;
  font-size: 14px;
  line-height: 1.6;
`;

const bubbleUser = css`
  background-color: var(--color-blue-500);
  color: white;
  border-bottom-right-radius: 6px;
`;

const bubbleAssistant = css`
  background-color: var(--color-gray-100);
  color: var(--color-gray-800);
  border-bottom-left-radius: 6px;
`;

const bubbleButton = css`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  text-align: left;
  transition: opacity 150ms;

  &:hover {
    opacity: 0.85;
  }
`;

export function ChatBubble({
  role,
  children,
  onClick,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const isUser = role === "user";

  if (onClick) {
    return (
      <div css={css({ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" })}>
        <button
          type="button"
          onClick={onClick}
          title="눌러서 다시 선택하기"
          css={[bubbleBase, isUser ? bubbleUser : bubbleAssistant, bubbleButton]}
        >
          {children}
          <HiPencil style={{ height: "0.875rem", width: "0.875rem", flexShrink: 0, opacity: 0.7 }} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div css={css({ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" })}>
      <div css={[bubbleBase, isUser ? bubbleUser : bubbleAssistant]}>{children}</div>
    </div>
  );
}

const pulseDot = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`;

export function TypingBubble() {
  return (
    <div css={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: var(--radius-md);
          border-bottom-left-radius: 6px;
          background-color: var(--color-gray-100);
          padding: 0.75rem 1rem;
        `}
      >
        <span
          css={css`
            height: 0.375rem;
            width: 0.375rem;
            border-radius: 9999px;
            background-color: var(--color-gray-500);
            animation: ${pulseDot} 1.1s ease-in-out infinite;
          `}
        />
        <span
          css={css`
            height: 0.375rem;
            width: 0.375rem;
            border-radius: 9999px;
            background-color: var(--color-gray-500);
            animation: ${pulseDot} 1.1s ease-in-out infinite;
            animation-delay: 150ms;
          `}
        />
        <span
          css={css`
            height: 0.375rem;
            width: 0.375rem;
            border-radius: 9999px;
            background-color: var(--color-gray-500);
            animation: ${pulseDot} 1.1s ease-in-out infinite;
            animation-delay: 300ms;
          `}
        />
      </div>
    </div>
  );
}
