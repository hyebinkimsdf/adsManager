/** @jsxImportSource @emotion/react */
"use client";

import { HiOutlineArrowPath, HiOutlineExclamationCircle } from "react-icons/hi2";
import { Button } from "./Button";

export function DataState({ title, error = false, onRetry }: { title: string; error?: boolean; onRetry?: () => void }) {
  const Icon = error ? HiOutlineExclamationCircle : HiOutlineArrowPath;
  return (
    <section role={error ? "alert" : "status"} aria-live="polite" css={{ padding: "1.25rem", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderRadius: "var(--radius-lg)", background: "white", border: "1px solid var(--border-subtle)" }}>
      <Icon size={22} aria-hidden="true" />
      <div css={{ flex: 1, minWidth: 160 }}>
        <p css={{ fontWeight: 600 }}>{title}</p>
        {error && <p css={{ marginTop: 4, fontSize: 13, color: "var(--color-gray-600)" }}>연결을 확인한 뒤 다시 눌러주세요. 예시 데이터로 대신 보여주지 않아요.</p>}
      </div>
      {error && onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>다시 불러오기</Button>}
    </section>
  );
}
