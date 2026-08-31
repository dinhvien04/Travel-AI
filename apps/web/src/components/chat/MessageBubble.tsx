import type { ReactNode } from "react";

type MessageBubbleProps = {
  role: "user" | "bot";
  children: ReactNode;
};

export function MessageBubble({ children, role }: MessageBubbleProps) {
  return <div className={`message-row message-row-${role}`}>{children}</div>;
}
