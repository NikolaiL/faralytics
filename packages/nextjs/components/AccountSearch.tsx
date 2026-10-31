"use client";
import { NumberText } from "./NumberText";
import { useEffect, useRef, useState } from "react";
import { AvatarImage } from "./AvatarImage";
import type { SearchProfile } from "~~/lib/activity";

export function AccountSearch({
  value,
  onChange,
  onSelect,
  busy,
  resolved,
  onReset,
  onShowMe,
  searchId = "lookup",
  label = "Username or FID",
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (fid: string) => void;
  busy: boolean;
  resolved: boolean;
  onReset: () => void;
  onShowMe?: () => void;
  searchId?: string;
  label?: string;
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
    if (open && active >= 0)
      document.getElementById(`${searchId}-result-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, searchId]);

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
          {busy ? <span className="search-spinner" data-testid={`${searchId}-spinner`} /> : "⌕"}
        </span>
        <label className="sr-only" htmlFor={searchId === "lookup" ? "username" : `${searchId}-input`}>
          {label}
        </label>
        <input
          ref={input}
          id={searchId === "lookup" ? "username" : `${searchId}-input`}
          data-testid={`${searchId}-input`}
          value={value}
          disabled={busy}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setResults([]);
            setActive(-1);
            setSearching(true);
          }}
          onFocus={() => {
            if (value.trim()) setOpen(true);
          }}
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
          aria-controls={`${searchId}-results`}
          aria-activedescendant={open && active >= 0 && results[active] ? `${searchId}-result-${active}` : undefined}
          placeholder="Username or FID"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          required
        />
        {resolved ? (
          <button
            key="clear"
            type="button"
            className="search-clear"
            data-testid={`${searchId}-clear`}
            aria-label={label === "Username or FID" ? "Clear lookup and chart" : `Clear ${label.toLowerCase()}`}
            title="Clear"
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              setResults([]);
              setMessage("");
              setActive(-1);
              setSearching(false);
              onReset();
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        ) : !value.trim() && onShowMe ? (
          <button
            key="show-me"
            data-testid="show-me"
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onShowMe();
            }}
          >
            {busy ? "Looking up…" : "Show me"}
            <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <button
            key="submit"
            data-testid={`${searchId}-submit`}
            type="submit"
            disabled={busy || !value.trim()}
            onClick={() => setOpen(false)}
          >
            {busy ? "Looking up…" : "Look up"}
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
      {open && (
        <div
          className="search-dropdown"
          data-testid={searchId === "lookup" ? "search-dropdown" : `${searchId}-dropdown`}
        >
          <ul id={`${searchId}-results`} role="listbox" aria-label="Matching Farcaster accounts" aria-busy={searching}>
            {results.map((profile, index) => (
              <li key={`${profile.fid}:${profile.username}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${searchId}-result-${index}`}
                  aria-selected={active === index}
                  tabIndex={-1}
                  disabled={busy}
                  data-testid={searchId === "lookup" ? "search-result" : `${searchId}-result`}
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
                      {profile.username ? `@${profile.username} · ` : ""}FID <NumberText>{profile.fid}</NumberText>
                    </span>
                    <span className="result-followers">
                      <NumberText>
                        {profile.followerCount === null
                          ? "Followers unavailable"
                          : `${profile.followerCount.toLocaleString("en-US")} followers`}
                      </NumberText>
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
              : message || `${results.length} matching account${results.length === 1 ? "" : "s"}. Select an account.`}
          </div>
        </div>
      )}
    </div>
  );
}
