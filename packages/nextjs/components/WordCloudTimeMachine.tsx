"use client";

import { useEffect, useRef, useState } from "react";
import { cloudHeight, cloudWidth, cloudWordColor, cloudWordSize, packWords } from "~~/lib/word-cloud-layout";
import type { WordCloudFrame } from "~~/lib/word-cloud";

const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" });

function TimelineCloud({ words }: { words: WordCloudFrame["words"] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !words.length) return;
    context.clearRect(0, 0, cloudWidth, cloudHeight);
    const measured = words.slice(0, 40).map(([word, count]) => {
      const fontSize = cloudWordSize(word, count, words[0][1]);
      context.font = `700 ${fontSize}px Arial, sans-serif`;
      const metrics = context.measureText(word);
      return {
        word,
        fontSize,
        bearing: metrics.actualBoundingBoxLeft,
        ascent: metrics.actualBoundingBoxAscent,
        width: Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) + 2,
        height: Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 2,
      };
    });
    for (const { index, left, top, width, height, angle } of packWords(measured, cloudHeight)) {
      const word = measured[index];
      context.save();
      context.translate(left + (angle ? width : 0), top);
      if (angle) context.rotate(Math.PI / 2);
      context.scale((angle ? height : width) / word.width, (angle ? width : height) / word.height);
      context.font = `700 ${word.fontSize}px Arial, sans-serif`;
      context.fillStyle = cloudWordColor(index);
      context.fillText(word.word, word.bearing + 1, word.ascent + 1);
      context.restore();
    }
  }, [words]);
  return words.length ? (
    <canvas
      ref={canvas}
      className="word-cloud-time-frame"
      width={cloudWidth}
      height={cloudHeight}
      role="img"
      aria-label={`Word cloud. Most used: ${words
        .slice(0, 5)
        .map(([word]) => word)
        .join(", ")}`}
    />
  ) : (
    <p className="timeline-empty">No matching words yet.</p>
  );
}

export function WordCloudTimeMachine({ fid }: { fid: string }) {
  const [result, setResult] = useState<{ frames: WordCloudFrame[] } | { error: string }>();
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frames = result && "frames" in result ? result.frames : undefined;
  const last = (frames?.length ?? 1) - 1;
  const frame = frames?.[index];

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/word-cloud/timeline?${new URLSearchParams({ user: fid })}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load the Time Machine.");
        if (!controller.signal.aborted) setResult(body);
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ error: error instanceof Error ? error.message : "Could not load the Time Machine." });
      }
    }
    void load();
    return () => controller.abort();
  }, [fid, attempt]);

  useEffect(() => {
    if (!playing || index >= last) return;
    const timer = window.setTimeout(() => {
      setIndex(index + 1);
      if (index + 1 >= last) setPlaying(false);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [index, last, playing]);

  return (
    <div className="word-cloud-time-machine" id="word-cloud-time-machine">
      <div className="word-cloud-time-heading">
        <h2>Word Cloud Time Machine</h2>
        <p>Counts build up from the first captured cast with text. Older text may be missing. Dates are UTC.</p>
      </div>
      {!result && (
        <p role="status" className="timeline-empty">
          <span className="search-spinner" aria-hidden="true" /> Building the timeline…
        </p>
      )}
      {result && "error" in result && (
        <p role="alert" className="timeline-error">
          {result.error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setResult(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      {frames?.length === 0 && <p className="timeline-empty">No captured casts with text for this account.</p>}
      {frame && (
        <>
          <div className="word-cloud-time-canvas" data-testid="word-cloud-time-frame">
            <TimelineCloud key={frame.at} words={frame.words} />
          </div>
          <div className="word-cloud-time-controls">
            <div className="word-cloud-time-progress">
              <button
                type="button"
                className="button-primary"
                disabled={last < 1}
                onClick={() => {
                  if (playing) setPlaying(false);
                  else {
                    if (index === last) setIndex(0);
                    setPlaying(true);
                  }
                }}
              >
                {playing ? "Pause" : index === last && last > 0 ? "Replay" : "Play"}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(last, 0)}
                value={index}
                disabled={last < 1}
                aria-label="Word cloud timeline"
                aria-valuetext={date.format(Number(frame.at) * 1000)}
                onChange={(event) => {
                  setPlaying(false);
                  setIndex(Number(event.target.value));
                }}
              />
            </div>
            <div className="word-cloud-time-caption">
              <strong data-testid="word-cloud-time-date">{date.format(Number(frame.at) * 1000)}</strong>
              <span>{frame.casts.toLocaleString("en-US")} captured casts with text</span>
            </div>
            {!!frame.words.length && (
              <p className="word-cloud-time-leaders">
                Top words:{" "}
                {frame.words
                  .slice(0, 3)
                  .map(([word, count]) => `${word} · ${count.toLocaleString("en-US")}`)
                  .join("  /  ")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
