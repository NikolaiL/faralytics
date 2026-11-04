"use client";

import { useState } from "react";
import { relativeEventTime } from "~~/lib/follow-timeline";
import { NumberText } from "./NumberText";

const utcFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

export function TimelineTime({ timestamp, now }: { timestamp: string; now: number }) {
  const [absolute, setAbsolute] = useState(false);
  const exact = `${utcFormat.format(new Date(timestamp))} UTC`;
  return (
    <button
      type="button"
      className="timeline-time-toggle"
      aria-pressed={absolute}
      aria-label={`Show absolute timestamp: ${exact}`}
      title={exact}
      onClick={() => setAbsolute((previous) => !previous)}
    >
      <time dateTime={timestamp}>
        <NumberText>{absolute ? exact : relativeEventTime(timestamp, now)}</NumberText>
      </time>
    </button>
  );
}
