/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useState } from "react";
import Link from "next/link";
import {
  HiOutlineChartBarSquare,
  HiOutlineMegaphone,
  HiOutlinePlusCircle,
  HiChevronRight,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

const cardStyle = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: var(--radius-md);
  background: white;
  padding: 1rem;
  box-shadow: var(--shadow-card);
  transition: background-color 150ms;

  &:hover {
    background-color: var(--color-gray-50);
  }
`;

function QuickLinkCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  note,
  ...rest
}: {
  icon: IconType;
  iconBg: string;
  iconColor: string;
  label: string;
  note?: string;
} & ({ href: string } | { onClick: () => void })) {
  const content = (
    <>
      <span
        css={css`
          display: flex;
          height: 2.5rem;
          width: 2.5rem;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
        `}
        style={{ backgroundColor: iconBg }}
      >
        <Icon style={{ height: "1.25rem", width: "1.25rem", color: iconColor }} aria-hidden="true" />
      </span>
      <span
        css={css`
          min-width: 0;
          flex: 1;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-gray-900);
        `}
      >
        {label}
        {note && <span css={{ marginLeft: "0.375rem", fontSize: 12, fontWeight: 500, color: "var(--color-gray-400)" }}>{note}</span>}
      </span>
      <HiChevronRight style={{ height: "1rem", width: "1rem", flexShrink: 0, color: "var(--color-gray-400)" }} aria-hidden="true" />
    </>
  );

  if ("href" in rest) {
    return (
      <Link href={rest.href} css={cardStyle}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={rest.onClick} css={cardStyle}>
      {content}
    </button>
  );
}

export function SimpleQuickLinkCards({ onShowList }: { onShowList: () => void }) {
  const [reportNotice, setReportNotice] = useState(false);

  return (
    <div>
      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.625rem;
          @media (min-width: 640px) {
            grid-template-columns: repeat(3, 1fr);
          }
        `}
      >
        <QuickLinkCard
          icon={HiOutlineMegaphone}
          iconBg="var(--color-blue-50)"
          iconColor="var(--color-blue-600)"
          label="캠페인 목록 보기"
          onClick={onShowList}
        />
        <QuickLinkCard
          icon={HiOutlineChartBarSquare}
          iconBg="var(--color-gray-100)"
          iconColor="var(--color-gray-700)"
          label="성과 리포트 보기"
          note={reportNotice ? "준비 중이에요" : undefined}
          onClick={() => setReportNotice(true)}
        />
        <QuickLinkCard
          icon={HiOutlinePlusCircle}
          iconBg="var(--color-green-50)"
          iconColor="var(--color-green-600)"
          label="새 캠페인 만들기"
          href="/campaigns/new"
        />
      </div>
    </div>
  );
}
