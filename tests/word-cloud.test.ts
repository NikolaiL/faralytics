import assert from "node:assert/strict";
import test from "node:test";
import { packWords, placeWord, cloudHeight, cloudWidth, type WordPlacement } from "../packages/nextjs/lib/word-cloud-layout.ts";
import { nextWordCloudPlaybackDay, wordCloudDaysPerPage, wordCloudTimelineDays, wordCloudPath, wordCloudSelection } from "../packages/nextjs/lib/word-cloud.ts";
import { fitMovingWord, interpolateWord, type WordPose } from "../packages/nextjs/lib/word-cloud-motion.ts";

test("word cloud shares preserve a valid UTC cutoff and default to 30 days", () => {
  const now = 1794102007;
  const selection = wordCloudSelection("invalid", "1999999999", now);
  assert.deepEqual(selection, { period: "30", at: "1794102000" });
  const pinned = wordCloudSelection("365", "1794101940", now);
  assert.equal(wordCloudPath("366713", pinned, "1794102007000"),
    "/word-cloud?user=366713&period=365&at=1794101940&ts=1794102007000");
});

test("dense word clouds shrink to fit more terms while sparse clouds keep their original size", () => {
  const words = Array.from({ length: 52 }, () => ({ width: 150, height: 64, fontSize: 80 }));
  const dense = packWords(words, cloudHeight);
  assert.ok(dense.length >= 50);
  assert.ok(dense[0].width < words[0].width);
  for (const [index, box] of dense.entries()) {
    for (const other of dense.slice(0, index)) {
      assert.ok(box.left >= other.left + other.width + 10 || other.left >= box.left + box.width + 10 ||
        box.top >= other.top + other.height + 10 || other.top >= box.top + box.height + 10);
    }
  }
  assert.equal(packWords(words.slice(0, 3), cloudHeight)[0].width, words[0].width);
});

test("word cloud packs rendered rectangles at 0 or clockwise 90 degrees without touching", () => {
  const placements: WordPlacement[] = [];
  for (let index = 0; index < 55; index++) {
    const width = 220 - index * 2;
    const height = 70 - index;
    const box = placeWord(width, height, placements, index % 5 === 4);
    if (!box) continue;
    assert.deepEqual([box.width, box.height], box.angle === 90 ? [height, width] : [width, height]);
    assert.ok(box.left >= 10 && box.top >= 10 && box.left + box.width <= cloudWidth - 10 &&
      box.top + box.height <= cloudHeight - 10);
    for (const other of placements) {
      assert.ok(box.left >= other.left + other.width + 10 || other.left >= box.left + box.width + 10 ||
        box.top >= other.top + other.height + 10 || other.top >= box.top + box.height + 10);
    }
    placements.push(box);
  }
  assert.ok(placements.length > 25);
  assert.ok(placements.some(box => box.angle === 90));
});


test("time machine pages contain every UTC day and end at the exact cutoff", () => {
  const first = Date.parse("2024-02-21T18:13:55Z") / 1000;
  const cutoff = Date.parse("2026-11-08T04:02:00Z") / 1000;
  const start = wordCloudTimelineDays(first, cutoff, 0);
  assert.equal(start.frames.length, wordCloudDaysPerPage);
  const pages = Array.from({ length: Math.ceil(start.days / wordCloudDaysPerPage) }, (_, page) =>
    wordCloudTimelineDays(first, cutoff, page),
  );
  const frames = pages.flatMap(page => page.frames);
  assert.equal(frames.length, start.days);
  assert.equal(new Date(frames[0] * 1000).toISOString(), "2024-02-21T23:59:59.000Z");
  assert.equal(frames.at(-1), cutoff);
  assert.ok(frames.every((frame, index) => Math.floor(frame / 86400) === Math.floor(first / 86400) + index));
  assert.deepEqual(wordCloudTimelineDays(cutoff - 60, cutoff, 0).frames, [cutoff]);
  assert.deepEqual(wordCloudTimelineDays(first, cutoff, pages.length).frames, []);
});

test("time machine interpolates a retained word's position, size and color", () => {
  const first: WordPose = { x: 100, y: 100, width: 100, height: 40, angle: 0, opacity: 1, color: [80, 100, 120] };
  const next: WordPose = { ...first, x: 200, width: 60, angle: Math.PI / 2, color: [100, 200, 220] };
  const middle = interpolateWord(first, next, 0.5);
  assert.deepEqual(middle, { ...first, x: 150, width: 80, angle: Math.PI / 4, color: [90, 150, 170] });
  const obstacle = { x: 100, y: 100, halfWidth: 20, halfHeight: 20 };
  const fit = fitMovingWord(middle, [obstacle]);
  assert.ok(fit);
  assert.ok(fit.pose.width < middle.width);
  assert.ok(fit.bounds.x - fit.bounds.halfWidth >= obstacle.x + obstacle.halfWidth + 3);
});

test("time machine packs a growing word around its previous center without rotating it", () => {
  const anchor = { x: 300, y: 170, angle: 90 as const };
  const [box] = packWords([{ width: 140, height: 40, fontSize: 70 }], cloudHeight, [anchor]);
  assert.deepEqual(box, { index: 0, left: 280, top: 100, width: 40, height: 140, angle: 90 });
  const nearby = placeWord(140, 40, [{ left: 315, top: 110, width: 20, height: 100 }], false, cloudHeight, anchor);
  assert.ok(nearby);
  assert.equal(nearby.angle, 90);
  assert.ok(nearby.left + nearby.width <= 305);
  assert.ok(Math.abs(nearby.left + nearby.width / 2 - anchor.x) <= 32);
});

test("time machine playback groups new casts and still ends on the last UTC day", () => {
  const activity = [1, 1, 3, 5, 5, 7, 9, 9];
  assert.equal(nextWordCloudPlaybackDay(activity, 0), 5);
  assert.equal(nextWordCloudPlaybackDay(activity, 5), 7);
  assert.equal(nextWordCloudPlaybackDay(activity, 7), 7);
  const dense = Array.from({ length: 200 }, (_, day) => (day + 1) * 100);
  assert.equal(nextWordCloudPlaybackDay(dense, 0), 2);
});
