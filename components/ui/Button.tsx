import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--color-blue-500)] text-white hover:bg-[var(--color-blue-600)] active:bg-[var(--color-blue-700)] disabled:bg-[var(--color-gray-200)] disabled:text-[var(--color-gray-400)]",
  secondary:
    "bg-[var(--color-gray-100)] text-[var(--color-gray-800)] hover:bg-[var(--color-gray-200)] disabled:text-[var(--color-gray-400)]",
  ghost:
    "bg-transparent text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] disabled:text-[var(--color-gray-400)]",
  danger:
    "bg-[var(--color-red-50)] text-[var(--color-red-500)] hover:bg-[#fbdcda] disabled:text-[var(--color-gray-400)]",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-4 text-[14px] gap-2",
  lg: "h-13 px-5 text-[15px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-blue-500)] focus-visible:ring-offset-2 disabled:cursor-not-allowed",
          variantClass[variant],
          sizeClass[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
