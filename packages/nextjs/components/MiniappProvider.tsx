"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import { createContext, useContext, useEffect, useState } from "react";
type Host = { fid?: string; isMiniApp: boolean; ready: boolean };
const HostContext = createContext<Host>({ isMiniApp: false, ready: false });
export const useMiniapp = () => useContext(HostContext);
export function MiniappProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<Host>({ isMiniApp: false, ready: false });
  useEffect(() => {
    let active = true;
    const injected = window as Window & { WorldApp?: unknown; ethereum?: { isMiniPay?: boolean } };
    if (injected.WorldApp || injected.ethereum?.isMiniPay) {
      setHost({ isMiniApp: false, ready: true });
      return;
    }
    void sdk.actions.ready().catch(() => {});
    void (async () => {
      try {
        const possibleHost =
          !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView || window !== window.parent;
        // This SDK version supports a timeout at runtime but omits it from its type.
        let isMiniApp = await (sdk.isInMiniApp as (timeoutMs: number) => Promise<boolean>)(10000);
        // Keep uncertain embedded launches pending rather than classifying them as anonymous.
        while (active && possibleHost && !isMiniApp) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (!active) return;
          isMiniApp = await (sdk.isInMiniApp as (timeoutMs: number) => Promise<boolean>)(10000);
        }
        if (!active) return;
        if (!isMiniApp) {
          setHost({ isMiniApp: false, ready: true });
          return;
        }
        const context = await sdk.context;
        if (!active) return;
        setHost({ isMiniApp: true, ready: true, fid: context.user?.fid ? String(context.user.fid) : undefined });
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
