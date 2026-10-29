import sharp from "sharp";
import { trustedAvatarUrl } from "./avatar-url";

export async function loadAvatar(source?: string | null): Promise<Buffer | null> {
  const url = trustedAvatarUrl(source);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
      next: { revalidate: 3600 },
    });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (
      !response.ok ||
      !response.body ||
      !type ||
      !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(type)
    )
      return null;
    const maxBytes = 5_000_000;
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return await sharp(Buffer.concat(chunks), { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(128, 128, { fit: "cover" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
