import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AssistantAvatar() {
  return (
    <div
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-700 text-white shadow-sm"
      aria-hidden="true"
    >
      <ShieldCheck className="h-5 w-5" />
    </div>
  );
}

type ShellProps = {
  children: ReactNode;
  /** Ocupa toda a largura disponível (usado pelo cartão da GTA). */
  wide?: boolean;
  className?: string;
};

export function AssistantShell({
  children,
  wide = false,
  className = "",
}: ShellProps) {
  return (
    <div className={`message-enter flex gap-2.5 ${className}`}>
      <AssistantAvatar />
      <div className={`min-w-0 ${wide ? "flex-1" : "max-w-[34rem]"}`}>
        {children}
      </div>
    </div>
  );
}

export function AssistantBubble({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AssistantShell>
      <div
        className={`rounded-3xl rounded-tl-md border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] leading-relaxed text-bark-700 shadow-sm ${className}`}
      >
        {children}
      </div>
    </AssistantShell>
  );
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="message-enter flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-md bg-forest-700 px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm">
        {children}
      </div>
    </div>
  );
}
