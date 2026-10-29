// Only relay known public image hosts; never fetch arbitrary profile URLs server-side.
export function trustedAvatarUrl(source?: string | null): string | null {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const allowed =
      (url.hostname === "imagedelivery.net" && /^\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)) ||
      (url.hostname === "i.imgur.com" && /^\/[a-zA-Z0-9]+\.(png|jpe?g|gif|webp)$/i.test(url.pathname)) ||
      (url.hostname === "res.cloudinary.com" && url.pathname.startsWith("/base-app/image/upload/")) ||
      (url.hostname === "media.firefly.land" && url.pathname.startsWith("/lens/")) ||
      (url.hostname === "ipfs.decentralized-content.com" && url.pathname.startsWith("/ipfs/"));
    if (!allowed) return null;
    if (url.hostname === "imagedelivery.net")
      url.pathname = url.pathname.replace(/\/[^/]+$/, "/width=128,height=128,fit=cover");
    return url.toString();
  } catch {
    return null;
  }
}
export function avatarDisplayUrl(source?: string | null): string | null {
  if (!source || !/^https?:\/\//i.test(source)) return null;
  return trustedAvatarUrl(source) ? `/api/avatar?url=${encodeURIComponent(source)}` : source;
}
