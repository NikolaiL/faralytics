import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "~~/utils/db";
import { InputError } from "~~/lib/activity";
import { liveOgEvents, liveSelection, type LiveSnapshot, type LiveType, type LiveDirection } from "~~/lib/live-view";
import { loadLiveView } from "~~/lib/live-view-data";

export async function createLiveShare(input: Record<string, unknown>) {
  if (
    (input.user !== undefined && typeof input.user !== "string") ||
    (input.type !== undefined && typeof input.type !== "string") ||
    (input.direction !== undefined && typeof input.direction !== "string")
  )
    throw new InputError("Choose a valid activity filter.");
  const selection = liveSelection(
    new URLSearchParams({
      type: (input.type as string) || "all",
      direction: (input.direction as string) || "actor",
      ...(input.user ? { user: input.user as string } : {}),
    }),
  );
  const data = await loadLiveView(selection);
  const snapshot: LiveSnapshot = {
    date: data.date,
    totals: data.totals,
    source: data.source,
    profile: data.profile,
    type: selection.type,
    direction: selection.direction,
    events: liveOgEvents(data.events ?? [], 800),
  };
  const payload = JSON.stringify(snapshot);
  if (Buffer.byteLength(payload) > 128000) throw new InputError("Activity snapshot is too large.");
  const id = createHash("sha256").update(payload).digest("hex");
  await getDb()`INSERT INTO live_view_shares (id,payload) VALUES (${id},${payload}::jsonb) ON CONFLICT (id) DO NOTHING`;
  return { id, ...snapshot };
}
export async function readLiveShare(
  id: string,
  selection: { user?: string; type: LiveType; direction?: LiveDirection },
): Promise<LiveSnapshot> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new InputError("Invalid activity snapshot.");
  const rows = await getDb()`SELECT payload FROM live_view_shares WHERE id=${id}`;
  const row = (rows as { payload: LiveSnapshot }[])[0];
  if (!row) throw new InputError("Activity snapshot not found.", 404);
  if (
    row.payload.profile?.fid !== selection.user ||
    row.payload.type !== selection.type ||
    (row.payload.direction ?? "actor") !== (selection.direction ?? "actor")
  )
    throw new InputError("Snapshot filters do not match this link.");
  return row.payload;
}
