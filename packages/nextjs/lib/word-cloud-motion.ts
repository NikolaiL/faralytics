import { cloudHeight, cloudWidth } from "./word-cloud-layout.ts";

export type WordPose = {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  color: readonly [number, number, number];
};

type WordBounds = { x: number; y: number; halfWidth: number; halfHeight: number };
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

export function blendWordColor(from: WordPose["color"], to: WordPose["color"], progress: number): WordPose["color"] {
  return [mix(from[0], to[0], progress), mix(from[1], to[1], progress), mix(from[2], to[2], progress)];
}

export function interpolateWord(from: WordPose, to: WordPose, progress: number): WordPose {
  return {
    x: mix(from.x, to.x, progress),
    y: mix(from.y, to.y, progress),
    width: mix(from.width, to.width, progress),
    height: mix(from.height, to.height, progress),
    angle: mix(from.angle, to.angle, progress),
    opacity: mix(from.opacity, to.opacity, progress),
    color: blendWordColor(from.color, to.color, progress),
  };
}

export function fitMovingWord(pose: WordPose, occupied: WordBounds[]) {
  const { x, y, width, height, angle } = pose;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const halfWidth = (width * cos + height * sin) / 2;
  const halfHeight = (width * sin + height * cos) / 2;
  let scale = Math.min(1, x / halfWidth, (cloudWidth - x) / halfWidth, y / halfHeight, (cloudHeight - y) / halfHeight);
  // Give higher-ranked words priority. Lower-ranked words make room when motion paths cross.
  for (const other of occupied) {
    const fitX = (Math.abs(x - other.x) - other.halfWidth - 3) / halfWidth;
    const fitY = (Math.abs(y - other.y) - other.halfHeight - 3) / halfHeight;
    scale = Math.min(scale, Math.max(fitX, fitY));
  }
  if (scale <= 0) return;
  return {
    pose: { ...pose, width: width * scale, height: height * scale, opacity: pose.opacity * Math.min(1, scale * 2) },
    bounds: { x, y, halfWidth: halfWidth * scale, halfHeight: halfHeight * scale },
  };
}
