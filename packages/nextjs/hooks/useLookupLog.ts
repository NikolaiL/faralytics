"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniapp } from "~~/components/MiniappProvider";
import type { LookupTool } from "~~/lib/lookup-log";

export function useLookupLog(view: { tool: LookupTool; fids: string[]; period: string; end: string } | null) {
  const { ready, isMiniApp, fid } = useMiniapp();
  const [retry, setRetry] = useState(0);
  const forceAuth = useRef(false);
  const previous = useRef("");
  const sessionId = useRef<string | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const resetSession = useCallback(() => {
    sessionId.current = null;
    previous.current = "";
  }, []);
  const snapshot = view ? JSON.stringify(view) : "";
  useEffect(() => {
    // Never classify a cold Farcaster bridge as an anonymous browser.
    if (!snapshot || !ready || (isMiniApp && !fid)) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      if (previous.current === snapshot) return;
      const lookupId = (sessionId.current ||= crypto.randomUUID());
      // Serialize updates so the first browser response establishes the anonymous cookie.
      pending.current = pending.current
        .then(async () => {
          if (cancelled) return;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (isMiniApp) {
            const { token } = await sdk.quickAuth.getToken(forceAuth.current ? { force: "true" } : undefined);
            if (!token) throw new Error("Viewer authentication unavailable");
            headers.Authorization = `Bearer ${token}`;
          }
          if (cancelled) return;
          const response = await fetch("/api/lookup-log", {
            method: "POST",
            headers,
            body: JSON.stringify({ ...JSON.parse(snapshot), lookupId }),
            keepalive: true,
          });
          if (response.status === 401) forceAuth.current = true;
          if (!response.ok) throw new Error("Lookup logging unavailable");
          forceAuth.current = false;
          if (!cancelled) previous.current = snapshot;
        })
        .catch(() => {
          if (cancelled) return;
          console.warn("Lookup logging temporarily unavailable. Retrying.");
          retryTimer = setTimeout(() => setRetry((value) => value + 1), 5000);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [snapshot, ready, isMiniApp, fid, retry]);
  return resetSession;
}
