import { useEffect, useRef } from "react";

export function useScrollToBottom<TDependency>(dependency: TDependency) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [dependency]);

  return bottomRef;
}
