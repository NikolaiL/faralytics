"use client";

import { useEffect, useRef, useState } from "react";
import {
  cloudHeight,
  cloudWidth,
  cloudWordColor,
  cloudWordSize,
  packWords,
  type WordAnchor,
} from "~~/lib/word-cloud-layout";
import { blendWordColor, fitMovingWord, interpolateWord, type WordPose } from "~~/lib/word-cloud-motion";
import {
  nextWordCloudPlaybackDay,
  wordCloudDaySeconds,
  wordCloudDaysPerPage,
  type WordCloudFrame,
  type WordCloudTimelinePage,
} from "~~/lib/word-cloud";

const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" });

const referenceFontSize = 100;
const timelineFont = `700 ${referenceFontSize}px Arial, sans-serif`;
const basePurple = [133, 93, 205] as const;
const playbackStepMs = 460;
const animationMs = 390;

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

export function WordCloudCanvas({ words }: { words?: WordCloudFrame["words"] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const anchors = useRef(new Map<string, WordAnchor>());
  const visible = useRef(new Map<string, PaintedWord>());
  const initialized = useRef(false);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !words) return;
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
    const placements = packWords(
      measured,
      cloudHeight,
      measured.map(({ word }) => anchors.current.get(word)),
    );
    const nextAnchors = new Map<string, WordAnchor>();
    const next = placements.map(({ index, left, top, width, height, angle }) => {
      const { word, ink, count } = measured[index];
      const x = left + width / 2;
      const y = top + height / 2;
      nextAnchors.set(word, { x, y, angle });
      return {
        word,
        ink,
        pose: {
          x,
          y,
          width: angle ? height : width,
          height: angle ? width : height,
          angle: (angle * Math.PI) / 180,
          opacity: 1,
          color: wordColor(index, count / words[0][1]),
        },
      };
    });
    anchors.current = nextAnchors;
    const movements = [
      ...next.map((entry) => ({
        ...entry,
        from: visible.current.get(entry.word)?.pose ?? faded(entry.pose),
      })),
      ...Array.from(visible.current.values())
        .filter((entry) => !nextAnchors.has(entry.word))
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
        words?.length
          ? `Word cloud. Most used: ${words
              .slice(0, 5)
              .map(([word]) => word)
              .join(", ")}`
          : words
            ? "No matching words yet."
            : "Previous word cloud."
      }
    />
  );
}

export function WordCloudTimeMachine({ fid }: { fid: string }) {
  const [pages, setPages] = useState<Partial<Record<number, WordCloudTimelinePage>>>({});
  const [failure, setFailure] = useState<{ page: number; message: string }>();
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeline = pages[0];
  const at = timeline?.at;
  const last = (timeline?.days ?? 0) - 1;
  const page = Math.floor(index / wordCloudDaysPerPage);
  const offset = index % wordCloudDaysPerPage;
  const frame = pages[page]?.frames[offset];
  const nextIndex = timeline?.activity?.length
    ? nextWordCloudPlaybackDay(timeline.activity, index)
    : Math.min(last, index + 1);
  const nextPage = Math.floor(nextIndex / wordCloudDaysPerPage);
  const waitingForNext = playing && index < last && !pages[nextPage];
  const requestedPage = !pages[page] ? page : waitingForNext ? nextPage : null;
  const waitingPage = !frame ? page : waitingForNext ? nextPage : null;
  const error = failure?.page === waitingPage ? failure?.message : undefined;
  const currentDay = timeline ? date.format((timeline.firstDay + index * wordCloudDaySeconds) * 1000) : "";

  useEffect(() => {
    if (requestedPage === null) return;
    const controller = new AbortController();
    const pageNumber = requestedPage;
    async function load() {
      try {
        const params = new URLSearchParams({ user: fid, page: String(pageNumber) });
        if (at) params.set("at", at);
        const response = await fetch(`/api/word-cloud/timeline?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load the Time Machine.");
        if (!controller.signal.aborted) {
          const data = body as WordCloudTimelinePage;
          for (let day = 1; day < data.frames.length; day++) {
            if (data.frames[day].casts === data.frames[day - 1].casts)
              data.frames[day].words = data.frames[day - 1].words;
          }
          setPages((previous) => ({ ...previous, [pageNumber]: data }));
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setFailure({
            page: pageNumber,
            message: error instanceof Error ? error.message : "Could not load the Time Machine.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [at, fid, requestedPage, attempt]);

  useEffect(() => {
    if (!playing || !frame || index >= last || waitingForNext) return;
    const timer = window.setTimeout(() => {
      setIndex(nextIndex);
      if (nextIndex >= last) setPlaying(false);
    }, playbackStepMs);
    return () => window.clearTimeout(timer);
  }, [frame, index, last, nextIndex, playing, waitingForNext]);

  return (
    <div className="word-cloud-time-machine" id="word-cloud-time-machine">
      <div className="word-cloud-time-heading">
        <h2>Word Cloud Time Machine</h2>
        <p>Playback groups new casts and replies. Scrub to any UTC day. Older text may be missing.</p>
      </div>
      {!timeline && !error && (
        <p role="status" className="timeline-empty">
          <span className="search-spinner" aria-hidden="true" /> Building the timeline…
        </p>
      )}
      {error && (
        <p role="alert" className="timeline-error">
          {error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFailure(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      {timeline?.days === 0 && <p className="timeline-empty">No captured casts with text for this account.</p>}
      {last >= 0 && (
        <>
          <div className="word-cloud-time-canvas" data-testid="word-cloud-time-frame" aria-busy={!frame}>
            <WordCloudCanvas words={frame?.words} />
            {frame && !frame.words.length && (
              <p className="timeline-empty word-cloud-time-empty">No matching words yet.</p>
            )}
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
                aria-valuetext={currentDay}
                onChange={(event) => {
                  setPlaying(false);
                  setIndex(Number(event.target.value));
                }}
              />
            </div>
            <div className="word-cloud-time-caption">
              <strong data-testid="word-cloud-time-date">{currentDay}</strong>
              {frame ? (
                <span>{frame.casts.toLocaleString("en-US")} captured casts with text</span>
              ) : error ? (
                <span>Showing the previous snapshot</span>
              ) : (
                <span role="status">Loading selected day…</span>
              )}
            </div>
            {waitingForNext && !error && (
              <p role="status" className="word-cloud-time-leaders">
                Loading the next group…
              </p>
            )}
            {frame && !!frame.words.length && (
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
