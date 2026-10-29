"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import { createContext, useContext, useEffect, useState } from "react";
const HostContext = createContext<{ fid?: string; isMiniApp: boolean }>({ isMiniApp: false });
export const useMiniapp = () => useContext(HostContext);
export function MiniappProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<{ fid?: string; isMiniApp: boolean }>({ isMiniApp: false });
  useEffect(() => {
    let active = true;
    const injected = window as Window & { WorldApp?: unknown; ethereum?: { isMiniPay?: boolean } };
    if (injected.WorldApp || injected.ethereum?.isMiniPay) return;
    void sdk.actions.ready().catch(() => {});
    void (async () => {
      try {
        if (!(await sdk.isInMiniApp())) return;
        const context = await sdk.context;
        if (!active) return;
        setHost({ isMiniApp: true, fid: context.user?.fid ? String(context.user.fid) : undefined });
        const insets = context.client.safeAreaInsets;
        if (insets)
          for (const side of ["top", "right", "bottom", "left"] as const)
            document.documentElement.style.setProperty(
              `--safe-area-inset-${side}`,
              `max(env(safe-area-inset-${side}, 0px), ${Math.max(0, insets[side])}px)`,
            );
      } catch {
        /* Browser lookup works without host context. */
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}
