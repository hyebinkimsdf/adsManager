import { HiPencil } from "react-icons/hi2";
import { cn } from "@/lib/cn";

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
  const bubbleClass = cn(
    "max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] leading-relaxed",
    isUser
      ? "bg-[var(--color-blue-500)] text-white rounded-br-[6px]"
      : "bg-[var(--color-gray-100)] text-[var(--color-gray-800)] rounded-bl-[6px]"
  );

  if (onClick) {
    return (
      <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
        <button
          type="button"
          onClick={onClick}
          title="눌러서 다시 선택하기"
          className={cn(bubbleClass, "flex items-center gap-1.5 text-left transition-opacity hover:opacity-85")}
        >
          {children}
          <HiPencil className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={bubbleClass}>{children}</div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] rounded-bl-[6px] bg-[var(--color-gray-100)] px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--color-gray-500)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--color-gray-500)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--color-gray-500)] [animation-delay:300ms]" />
      </div>
    </div>
  );
}
