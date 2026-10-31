"use client";
import { NumberText } from "./NumberText";
import { useId, useState } from "react";
import { useMiniapp } from "./MiniappProvider";

export function ChartImages({
  basePath,
  params,
  filename,
  label,
  previewOnly = false,
}: {
  basePath: string;
  params: string;
  filename: string;
  label: string;
  previewOnly?: boolean;
}) {
  const { isMiniApp } = useMiniapp();
  const [preview, setPreview] = useState<"farcaster" | "x" | null>(null);
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const [previewAt, setPreviewAt] = useState("");
  const id = useId();
  const inlinePreview = isMiniApp || previewOnly;
  const imageParams = new URLSearchParams(params);
  if (previewOnly && previewAt) imageParams.set("ts", previewAt);
  const source = preview ? `${basePath}/${preview}.png?${imageParams}` : "";
  return (
    <>
      <div className="image-links">
        <span>{isMiniApp && !previewOnly ? "Preview chart" : label}</span>
        {(["farcaster", "x"] as const).map((format) =>
          inlinePreview ? (
            <button
              key={format}
              type="button"
              className="text-button"
              aria-expanded={preview === format}
              aria-controls={id}
              onClick={() => {
                setFailed("");
                if (previewOnly) setPreviewAt(Date.now().toString());
                setPreview(preview === format ? null : format);
              }}
            >
              <NumberText>{format === "farcaster" ? "Farcaster · 3:2" : "X · 2:1"}</NumberText>
            </button>
          ) : (
            <a
              key={format}
              href={`${basePath}/${format}.png?${params}`}
              download={`${filename}-${format}.png`}
              target="_blank"
              rel="noreferrer"
            >
              <NumberText>{format === "farcaster" ? "Farcaster · 3:2 ↗" : "X · 2:1 ↗"}</NumberText>
            </a>
          ),
        )}
      </div>
      {inlinePreview && preview && (
        <div id={id} className="chart-image-preview">
          <button type="button" className="text-button" onClick={() => setPreview(null)}>
            Close preview ×
          </button>
          {failed === source ? (
            <p role="alert">Could not load the image. Close the preview and try again.</p>
          ) : (
            <>
              {loaded !== source && <p role="status">Preparing chart image…</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={source}
                src={source}
                alt={`${preview === "farcaster" ? "Farcaster" : "X"} chart share image`}
                width={1200}
                height={preview === "farcaster" ? 800 : 600}
                onLoad={() => setLoaded(source)}
                onError={() => setFailed(source)}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
