"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sdk } from "@farcaster/miniapp-sdk";
import { CREATOR_FID } from "~~/lib/follow-status";
const FollowGateContext = createContext({ canPromptAdd: true });
export const useFollowGate = () => useContext(FollowGateContext);
type Host = { ready: boolean; isMiniApp: boolean; fid?: string };
type Status = "idle" | "checking" | "following" | "not_following" | "unknown";
export function FollowGateProvider({ host, children }: { host: Host; children: React.ReactNode }) {
  const [activated, setActivated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [mounted, setMounted] = useState(false);
  const [profileError, setProfileError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const openedProfile = useRef(false);
  const previousFid = useRef(host.fid);
  const forceAuth = useRef(false);
  const owner = host.fid === CREATOR_FID;
  const locked = activated && host.ready && host.isMiniApp && !owner && status !== "following";
  useEffect(() => {
    setMounted(true);
    const lifecycle = version;
    return () => {
      lifecycle.current++;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (previousFid.current && previousFid.current !== host.fid) forceAuth.current = true;
    previousFid.current = host.fid;
    openedProfile.current = false;
    version.current++;
    controller.current?.abort();
    pending.current = false;
    setStatus("idle");
  }, [host.fid]);
  const check = useCallback(async () => {
    if (!host.ready || !host.isMiniApp || owner || pending.current) return;
    pending.current = true;
    const current = ++version.current;
    const abort = new AbortController();
    controller.current = abort;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("checking");
    setProfileError("");
    try {
      let result: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { token } = await Promise.race([
          sdk.quickAuth.getToken(attempt || forceAuth.current ? { force: "true" } : undefined),
          new Promise<never>((_, reject) => {
            authTimer = setTimeout(() => reject(new Error("Authentication timed out")), 20000);
          }),
        ]);
        clearTimeout(authTimer);
        if (!token || current !== version.current) throw new Error("Authentication unavailable");
        result = await fetch("/api/follow-status", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(28000)]),
        });
        if (result.status !== 401) break;
      }
      if (!result?.ok) throw new Error("Follow verification unavailable");
      const body = await result.json();
      if (current !== version.current) return;
      if (host.fid && body.viewerFid !== host.fid) {
        forceAuth.current = true;
        throw new Error("Viewer identity changed");
      }
      forceAuth.current = false;
      if (body.following === true) {
        dialog.current?.close();
        setStatus("following");
      } else setStatus(body.following === false ? "not_following" : "unknown");
    } catch {
      if (current === version.current) setStatus("unknown");
    } finally {
      clearTimeout(authTimer);
      if (current === version.current) pending.current = false;
    }
  }, [host.ready, host.isMiniApp, host.fid, owner]);
  useEffect(() => {
    if (activated && status === "idle") void check();
  }, [activated, status, check]);
  useEffect(() => {
    if (!mounted) return;
    if (locked && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      dialog.current.focus();
    } else if (!locked) dialog.current?.close();
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked, mounted]);
  useEffect(() => {
    if (!locked) return;
    const returned = () => {
      if (!document.hidden && openedProfile.current) {
        openedProfile.current = false;
        void check();
      }
    };
    window.addEventListener("focus", returned);
    document.addEventListener("visibilitychange", returned);
    return () => {
      window.removeEventListener("focus", returned);
      document.removeEventListener("visibilitychange", returned);
    };
  }, [locked, check]);
  function interact() {
    setActivated(true);
  }
  async function follow() {
    if (!host.isMiniApp) return;
    openedProfile.current = true;
    setProfileError("");
    try {
      await sdk.actions.viewProfile({ fid: Number(CREATOR_FID) });
    } catch {
      try {
        await sdk.actions.openUrl("https://farcaster.xyz/nikolaii.eth");
      } catch {
        setProfileError("Could not open the profile. Open @nikolaii.eth in Farcaster, then return and check again.");
      }
    }
  }
  const checking = status === "idle" || status === "checking";
  return (
    <FollowGateContext.Provider value={{ canPromptAdd: !host.isMiniApp || owner || status === "following" }}>
      <div
        style={{ display: "contents" }}
        onClickCapture={(event) => {
          if (
            event.isTrusted &&
            event.target instanceof Element &&
            event.target.closest("button,a,[role='button'],[role='option']")
          )
            interact();
        }}
        onSubmitCapture={(event) => {
          if (event.isTrusted) interact();
        }}
      >
        {children}
      </div>
      {mounted &&
        host.isMiniApp &&
        !owner &&
        createPortal(
          <dialog
            ref={dialog}
            className="follow-dialog"
            aria-labelledby="follow-gate-title"
            aria-describedby="follow-gate-description"
            aria-busy={checking}
            onCancel={(event) => event.preventDefault()}
            data-testid="follow-gate"
          >
            <h2 id="follow-gate-title">{checking ? "Checking your follow…" : "Support Faralytics"}</h2>
            <p id="follow-gate-description">
              {checking
                ? "Confirming whether you follow @nikolaii.eth on Farcaster."
                : "Please follow @nikolaii.eth to continue using Faralytics. Your follow is a small sign of support and respect for the work behind the app. Thank you!"}
            </p>
            <p className="follow-gate-status" role="status" data-testid="follow-gate-status">
              {checking
                ? "Checking follow status…"
                : status === "not_following"
                  ? "Not following yet. Follow, then check again."
                  : "We couldn’t verify your follow yet. Please try again shortly."}
            </p>
            {profileError && <p role="alert">{profileError}</p>}
            <button
              type="button"
              className="button-primary"
              onClick={() => void follow()}
              data-testid="follow-creator"
              disabled={checking}
            >
              Follow @nikolaii.eth ↗
            </button>
            <button type="button" onClick={() => void check()} data-testid="follow-recheck" disabled={checking}>
              {checking ? "Checking…" : "I’ve followed — check again"}
            </button>
            <button
              type="button"
              className="follow-gate-exit"
              onClick={() => {
                void sdk.actions
                  .close()
                  .catch(() => setProfileError("You can close this miniapp using Farcaster’s close button."));
              }}
            >
              Close miniapp
            </button>
          </dialog>,
          document.body,
        )}
    </FollowGateContext.Provider>
  );
}
