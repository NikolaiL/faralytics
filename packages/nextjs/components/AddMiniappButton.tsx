"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMiniapp } from "./MiniappProvider";
export function AddMiniappButton({ meaningfulInteraction = false }: { meaningfulInteraction?: boolean }) {
  const { isMiniApp, fid } = useMiniapp();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const autoAttempted = useRef(false);
  const [ready, setReady] = useState(false);
  const promptKey = `faralytics:add-prompted:${fid || "guest"}`;
  useEffect(() => {
    if (!isMiniApp) return;
    let active = true;
    const onAdded = () => {
      setAdded(true);
    };
    const onRemoved = () => {
      autoAttempted.current = true;
      try {
        localStorage.setItem(promptKey, "1");
      } catch {
        /* Keep an explicit removal respected without storage. */
      }
      setAdded(false);
      setMessage("");
    };
    sdk.on("miniAppAdded", onAdded);
    sdk.on("miniAppRemoved", onRemoved);
    void sdk.context
      .then((context) => {
        if (active) {
          setAdded(context.client.added);
          setReady(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      sdk.removeListener("miniAppAdded", onAdded);
      sdk.removeListener("miniAppRemoved", onRemoved);
    };
  }, [isMiniApp, promptKey]);
  const add = useCallback(async () => {
    if (pending.current || added) return;
    if (!isMiniApp) return;
    if (window.location.hostname !== "faralytics.vercel.app") {
      setMessage("Adding is available on faralytics.vercel.app inside Farcaster.");
      return;
    }
    autoAttempted.current = true;
    try {
      localStorage.setItem(promptKey, "1");
    } catch {
      /* The in-memory guard still avoids repeat prompts. */
    }
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await sdk.actions.addMiniApp();
      setAdded(true);
      setMessage(result.notificationDetails ? "Added! Notifications are enabled." : "Added to your miniapps.");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      setMessage(
        /RejectedByUser/.test(name)
          ? "No problem. You can add it later."
          : "Could not add Faralytics. Please try again inside Farcaster.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [added, isMiniApp, promptKey]);
  useEffect(() => {
    if (
      !isMiniApp ||
      !ready ||
      !meaningfulInteraction ||
      added ||
      autoAttempted.current ||
      window.location.hostname !== "faralytics.vercel.app"
    )
      return;
    autoAttempted.current = true;
    try {
      if (localStorage.getItem(promptKey)) return;
    } catch {
      /* Storage can be unavailable in a host. */
    }
    void add();
  }, [isMiniApp, ready, meaningfulInteraction, added, promptKey, add]);
  if (!isMiniApp || !ready || added) return null;
  return (
    <div className="add-miniapp">
      <button type="button" data-testid="add-miniapp" disabled={busy} onClick={() => void add()}>
        {busy ? "Adding…" : "＋ Add miniapp"}
      </button>
      {message && (
        <p role="status" data-testid="add-miniapp-status">
          {message}
        </p>
      )}
    </div>
  );
}
