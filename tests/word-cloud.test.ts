import assert from "node:assert/strict";
import test from "node:test";
import { packWords, placeWord, cloudHeight, cloudWidth, type WordPlacement } from "../packages/nextjs/lib/word-cloud-layout.ts";
import { wordCloudFrameEnds, wordCloudPath, wordCloudSelection } from "../packages/nextjs/lib/word-cloud.ts";

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


test("time machine starts with the first UTC day and ends at the exact cutoff", () => {
  const first = Date.parse("2024-02-21T18:13:55Z") / 1000;
  const cutoff = Date.parse("2026-11-08T04:02:00Z") / 1000;
  const frames = wordCloudFrameEnds(first, cutoff);
  assert.equal(frames.length, 14);
  assert.equal(new Date(frames[0] * 1000).toISOString(), "2024-02-21T23:59:59.000Z");
  assert.equal(frames.at(-1), cutoff);
  assert.ok(frames.every((frame, index) => !index || frame > frames[index - 1]));
  assert.deepEqual(wordCloudFrameEnds(cutoff - 60, cutoff), [cutoff]);
  assert.deepEqual(wordCloudFrameEnds(cutoff, cutoff - 86400), []);
});
