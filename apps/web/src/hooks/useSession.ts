import { useCallback, useMemo, useState } from "react";

import { SESSION_STORAGE_KEY } from "../utils/constants";

function createSessionId() {
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readSessionId() {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const next = createSessionId();
  localStorage.setItem(SESSION_STORAGE_KEY, next);

  return next;
}

export function useSession() {
  const [sessionId, setSessionId] = useState(readSessionId);

  const resetSession = useCallback(() => {
    const next = createSessionId();

    localStorage.setItem(SESSION_STORAGE_KEY, next);
    setSessionId(next);
  }, []);

  return useMemo(
    () => ({
      sessionId,
      resetSession,
    }),
    [resetSession, sessionId],
  );
}
