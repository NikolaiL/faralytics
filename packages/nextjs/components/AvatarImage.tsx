"use client";
import { avatarDisplayUrl } from "~~/lib/avatar-url";
export function AvatarImage({ source, size }: { source?: string | null; size: number }) {
  const src = avatarDisplayUrl(source);
  if (!src) return null;
  return (
    // External profile URLs need a normal img; initials stay underneath as the fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={(event) => {
        const image = event.currentTarget;
        if (src !== source && source && !image.dataset.direct) {
          image.dataset.direct = "true";
          image.src = source;
        } else image.style.display = "none";
      }}
    />
  );
}
