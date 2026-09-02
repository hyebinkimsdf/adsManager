import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "blue" | "gray" | "green" | "red";

const toneClass: Record<Tone, string> = {
  blue: "bg-[var(--color-blue-50)] text-[var(--color-blue-600)]",
  gray: "bg-[var(--color-gray-100)] text-[var(--color-gray-600)]",
  green: "bg-[var(--color-green-50)] text-[var(--color-green-600)]",
  red: "bg-[var(--color-red-50)] text-[var(--color-red-500)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
