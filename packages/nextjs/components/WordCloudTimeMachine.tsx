"use client";

import { useEffect, useRef, useState } from "react";
import { cloudHeight, cloudWidth, cloudWordColor, cloudWordSize, packWords } from "~~/lib/word-cloud-layout";
import { blendWordColor, fitMovingWord, interpolateWord, type WordPose } from "~~/lib/word-cloud-motion";
import type { WordCloudFrame } from "~~/lib/word-cloud";

const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" });

const referenceFontSize = 100;
const timelineFont = `700 ${referenceFontSize}px Arial, sans-serif`;
const basePurple = [133, 93, 205] as const;
const animationMs = 800;

type Ink = { width: number; height: number; bearing: number; ascent: number };
type PaintedWord = { word: string; ink: Ink; pose: WordPose };

function wordColor(rank: number, frequency: number): WordPose["color"] {
  const rgb = Number.parseInt(cloudWordColor(rank).slice(1), 16);
  const ranked = [rgb >> 16, (rgb >> 8) & 255, rgb & 255] as const;
  return rank === 0 ? ranked : blendWordColor(basePurple, ranked, 0.5 + 0.5 * Math.sqrt(frequency));
}

function faded(pose: WordPose): WordPose {
  return { ...pose, opacity: 0, width: pose.width * 0.65, height: pose.height * 0.65 };
}

function TimelineCloud({ words }: { words: WordCloudFrame["words"] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const visible = useRef(new Map<string, PaintedWord>());
  const initialized = useRef(false);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.font = timelineFont;
    const measured = words.slice(0, 40).map(([word, count]) => {
      const fontSize = cloudWordSize(word, count, words[0][1]);
      const metrics = context.measureText(word);
      const ink = {
        bearing: metrics.actualBoundingBoxLeft,
        ascent: metrics.actualBoundingBoxAscent,
        width: Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) + 2,
        height: Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 2,
      };
      return {
        word,
        ink,
        fontSize,
        count,
        width: Math.ceil((ink.width * fontSize) / referenceFontSize),
        height: Math.ceil((ink.height * fontSize) / referenceFontSize),
      };
    });
    const next = packWords(measured, cloudHeight).map(({ index, left, top, width, height, angle }) => {
      const { word, ink, count } = measured[index];
      return {
        word,
        ink,
        pose: {
          x: left + width / 2,
          y: top + height / 2,
          width: angle ? height : width,
          height: angle ? width : height,
          angle: (angle * Math.PI) / 180,
          opacity: 1,
          color: wordColor(index, count / words[0][1]),
        },
      };
    });
    const incoming = new Set(next.map(({ word }) => word));
    const movements = [
      ...next.map((entry) => ({
        ...entry,
        from: visible.current.get(entry.word)?.pose ?? faded(entry.pose),
      })),
      ...Array.from(visible.current.values())
        .filter((entry) => !incoming.has(entry.word))
        .map((entry) => ({ ...entry, from: entry.pose, pose: faded(entry.pose) })),
    ];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = performance.now();
    const duration = initialized.current ? animationMs : 0;
    initialized.current = true;
    let handle = 0;

    function paint(now: number) {
      if (!context) return;
      const elapsed = duration && !motion.matches ? Math.min(1, (now - started) / duration) : 1;
      const progress = elapsed * elapsed * (3 - 2 * elapsed);
      const occupied: Parameters<typeof fitMovingWord>[1] = [];
      const painted = new Map<string, PaintedWord>();
      context.clearRect(0, 0, cloudWidth, cloudHeight);
      for (const { word, ink, from, pose } of movements) {
        const current = interpolateWord(from, pose, progress);
        if (current.opacity < 0.01) continue;
        const fitted = fitMovingWord(current, occupied);
        if (!fitted || fitted.pose.opacity < 0.01) continue;
        const { x, y, angle, width, height, opacity, color } = fitted.pose;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.scale(width / ink.width, height / ink.height);
        context.globalAlpha = opacity;
        context.fillStyle = `rgb(${color.join(",")})`;
        context.fillText(word, ink.bearing + 1 - ink.width / 2, ink.ascent + 1 - ink.height / 2);
        context.restore();
        occupied.push(fitted.bounds);
        painted.set(word, { word, ink, pose: fitted.pose });
      }
      visible.current = painted;
      if (elapsed < 1) handle = requestAnimationFrame(paint);
    }

    paint(started);
    return () => cancelAnimationFrame(handle);
  }, [words]);

  return (
    <canvas
      ref={canvas}
      className="word-cloud-time-frame"
      width={cloudWidth}
      height={cloudHeight}
      role="img"
      aria-label={
        words.length
          ? `Word cloud. Most used: ${words
              .slice(0, 5)
              .map(([word]) => word)
              .join(", ")}`
          : "No matching words yet."
      }
    />
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
            <TimelineCloud words={frame.words} />
            {!frame.words.length && <p className="timeline-empty word-cloud-time-empty">No matching words yet.</p>}
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
