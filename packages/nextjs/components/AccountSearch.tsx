"use client";
import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "./AvatarImage";
import type { SearchProfile } from "~~/lib/activity";

export function AccountSearch({
  value,
  onChange,
  onSelect,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (fid: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const prefix = value.trim().replace(/^@/, "");
    if (!prefix) {
      setSearching(false);
      setResults([]);
      setMessage("Enter a username or FID.");
      return;
    }
    const abort = new AbortController();
    setSearching(true);
    setResults([]);
    setActive(-1);
    setMessage("");
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(`/api/search?${new URLSearchParams({ q: value })}`, { signal: abort.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Could not search accounts.");
          if (!abort.signal.aborted) {
            setResults(body);
            setMessage(body.length ? "" : "No matching accounts. Try their full username or FID.");
          }
        } catch (error) {
          if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not search accounts.");
        } finally {
          if (!abort.signal.aborted) setSearching(false);
        }
      },
      prefix.length === 1 ? 650 : 250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value, open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`account-result-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function select(profile: SearchProfile) {
    setOpen(false);
    input.current?.blur();
    onSelect(profile.fid);
  }
  return (
    <div
      className="account-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="search-field">
        <span aria-hidden="true" className="search-icon">
          ⌕
        </span>
        <label className="sr-only" htmlFor="username">
          Username or FID
        </label>
        <input
          ref={input}
          id="username"
          data-testid="lookup-input"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setResults([]);
            setActive(-1);
            setSearching(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (results.length)
                setActive((index) =>
                  event.key === "ArrowDown"
                    ? (index + 1) % results.length
                    : index <= 0
                      ? results.length - 1
                      : index - 1,
                );
            }
            if (event.key === "Enter") {
              if (open && active >= 0 && results[active]) {
                event.preventDefault();
                if (!busy) select(results[active]);
              } else setOpen(false);
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="account-results"
          aria-activedescendant={open && active >= 0 && results[active] ? `account-result-${active}` : undefined}
          placeholder="Username or FID"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          required
        />
        <button data-testid="lookup-submit" type="submit" disabled={busy} onClick={() => setOpen(false)}>
          {busy ? "Looking up…" : "Look up"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      {open && (
        <div className="search-dropdown" data-testid="search-dropdown">
          <ul id="account-results" role="listbox" aria-label="Matching Farcaster accounts" aria-busy={searching}>
            {results.map((profile, index) => (
              <li key={`${profile.fid}:${profile.username}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`account-result-${index}`}
                  aria-selected={active === index}
                  tabIndex={-1}
                  disabled={busy}
                  data-testid="search-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(profile)}
                >
                  <span className="result-avatar" aria-hidden="true">
                    {(profile.username || "fc").slice(0, 2)}
                    <AvatarImage source={profile.pfp_url} size={34} />
                  </span>
                  <span className="result-name">
                    <strong>
                      {profile.display_name || (profile.username ? `@${profile.username}` : `FID ${profile.fid}`)}
                    </strong>
                    <span>
                      {profile.username ? `@${profile.username} · ` : ""}FID {profile.fid}
                    </span>
                    <span className="result-followers">
                      {profile.followerCount === null
                        ? "Followers unavailable"
                        : `${profile.followerCount.toLocaleString("en-US")} followers`}
                    </span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="search-feedback" role="status" aria-live="polite">
            {searching
              ? "Searching accounts…"
              : message ||
                `${results.length} matching account${results.length === 1 ? "" : "s"}. Select one to view activity.`}
          </div>
        </div>
      )}
    </div>
  );
}
