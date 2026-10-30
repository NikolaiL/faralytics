"use client";
import { useCallback, useEffect, useRef } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { LookupTool } from "~~/lib/lookup-log";

export function useLookupLog(view: { tool: LookupTool; fids: string[]; period: string; end: string } | null) {
  const previous = useRef("");
  const sessionId = useRef<string | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const resetSession = useCallback(() => {
    sessionId.current = null;
    previous.current = "";
  }, []);
  const snapshot = view ? JSON.stringify(view) : "";
  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(() => {
      if (previous.current === snapshot) return;
      previous.current = snapshot;
      const lookupId = (sessionId.current ||= crypto.randomUUID());
      // Serialize updates so the first response can establish the anonymous cookie.
      pending.current = pending.current
        .then(async () => {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          // A cold host bridge must not prevent anonymous lookup logging.
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
          await Promise.race([
            (async () => {
              try {
                if (await sdk.isInMiniApp()) {
                  const { token } = await sdk.quickAuth.getToken();
                  if (token) headers.Authorization = `Bearer ${token}`;
                }
              } catch {
                /* Viewer identity is optional. */
              }
            })(),
            timeout,
          ]);
          const options = {
            method: "POST",
            headers: { ...headers },
            body: JSON.stringify({ ...JSON.parse(snapshot), lookupId }),
            keepalive: true,
          };
          let response = await fetch("/api/lookup-log", options);
          if (response.status === 401) {
            delete options.headers.Authorization;
            response = await fetch("/api/lookup-log", options);
          }
          if (!response.ok) throw new Error("Lookup logging unavailable");
        })
        .catch(() => console.warn("Lookup logging temporarily unavailable."));
    }, 150);
    return () => clearTimeout(timer);
  }, [snapshot]);
  return resetSession;
}
