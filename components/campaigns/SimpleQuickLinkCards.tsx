"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HiOutlineChartBarSquare,
  HiOutlineMegaphone,
  HiOutlinePlusCircle,
  HiChevronRight,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { cn } from "@/lib/cn";

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
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left text-[14px] font-semibold text-[var(--color-gray-900)]">
        {label}
        {note && <span className="ml-1.5 text-[12px] font-medium text-[var(--color-gray-400)]">{note}</span>}
      </span>
      <HiChevronRight className="h-4 w-4 shrink-0 text-[var(--color-gray-400)]" aria-hidden="true" />
    </>
  );

  const className = "flex items-center gap-3 rounded-[var(--radius-md)] bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-gray-50)]";

  if ("href" in rest) {
    return (
      <Link href={rest.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={rest.onClick} className={className}>
      {content}
    </button>
  );
}

export function SimpleQuickLinkCards({ onShowList }: { onShowList: () => void }) {
  const [reportNotice, setReportNotice] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <QuickLinkCard
          icon={HiOutlineMegaphone}
          iconBg="bg-[var(--color-blue-50)]"
          iconColor="text-[var(--color-blue-600)]"
          label="캠페인 목록 보기"
          onClick={onShowList}
        />
        <QuickLinkCard
          icon={HiOutlineChartBarSquare}
          iconBg="bg-[var(--color-gray-100)]"
          iconColor="text-[var(--color-gray-700)]"
          label="성과 리포트 보기"
          note={reportNotice ? "준비 중이에요" : undefined}
          onClick={() => setReportNotice(true)}
        />
        <QuickLinkCard
          icon={HiOutlinePlusCircle}
          iconBg="bg-[var(--color-green-50)]"
          iconColor="text-[var(--color-green-600)]"
          label="새 캠페인 만들기"
          href="/campaigns/new"
        />
      </div>
    </div>
  );
}
