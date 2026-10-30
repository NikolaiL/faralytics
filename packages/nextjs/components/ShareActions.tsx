"use client";
export function ShareActions({
  disabled,
  onShare,
  placement,
}: {
  disabled: boolean;
  onShare: (target: "farcaster" | "x" | "copy") => void;
  placement: "header" | "below";
}) {
  return (
    <div
      className={`share-actions ${placement === "below" ? "share-actions-below" : ""}`}
      role="group"
      aria-labelledby={`share-heading-${placement}`}
    >
      <p id={`share-heading-${placement}`}>a year worth sharing:</p>
      <div className="share-buttons">
        <button
          data-testid={placement === "header" ? "share-farcaster" : "share-farcaster-bottom"}
          aria-label="Share on Farcaster"
          disabled={disabled}
          className="button-primary"
          onClick={() => void onShare("farcaster")}
        >
          <span className="share-label-full">Share on Farcaster</span>
          <span className="share-label-short">FC</span>
        </button>
        <button
          data-testid={placement === "header" ? "share-x" : "share-x-bottom"}
          aria-label="Share on X"
          disabled={disabled}
          onClick={() => void onShare("x")}
        >
          <span className="share-label-full">Share on X</span>
          <span className="share-label-short">X</span>
        </button>
        <button
          data-testid={placement === "header" ? "copy-link" : "copy-link-bottom"}
          disabled={disabled}
          aria-label="Copy link"
          onClick={() => void onShare("copy")}
        >
          <span className="share-label-full">Copy link</span>
          <svg
            className="share-copy-icon"
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
