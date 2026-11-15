import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "~~/utils/db";
import { InputError } from "~~/lib/activity";
import { casterSelection, type CasterSelection, type TopCasters } from "~~/lib/top-casters";
import { loadTopCasters } from "~~/lib/top-casters-data";

export type CasterShare = { id: string; selection: CasterSelection; data: TopCasters };

export async function createCasterShare(input: Record<string, unknown>): Promise<CasterShare> {
  if (
    typeof input.period !== "string" ||
    typeof input.metric !== "string" ||
    (input.user !== undefined && typeof input.user !== "string")
  )
    throw new InputError("Choose a category, timeframe and optional account.");
  const params = new URLSearchParams({ period: input.period, metric: input.metric });
  if (typeof input.user === "string") params.set("user", input.user);
  const selection = casterSelection(params);
  if (selection.period !== input.period || selection.metric !== input.metric || selection.user !== input.user)
    throw new InputError("Choose valid ranking filters.");
  const result = await loadTopCasters(selection);
  const list = result.lists.find((list) => list.metric === selection.metric)!;
  const fids = new Set([
    ...list.rows.map((row) => row.fid),
    ...(list.nextRank ? [list.nextRank.fid] : []),
    selection.user,
  ]);
  const data = { ...result, lists: [list], profiles: result.profiles.filter((profile) => fids.has(profile.fid)) };
  const payload = JSON.stringify({ selection, data });
  if (Buffer.byteLength(payload) > 64000) throw new InputError("Ranking snapshot is too large.");
  const id = createHash("sha256").update(payload).digest("hex");
  await getDb()`INSERT INTO top_caster_shares (id, payload) VALUES (${id}, ${payload}::jsonb) ON CONFLICT (id) DO NOTHING`;
  return { id, selection, data };
}

export async function readCasterShare(id: string, selection: CasterSelection): Promise<CasterShare> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new InputError("Invalid ranking snapshot.");
  const rows = await getDb()`SELECT payload FROM top_caster_shares WHERE id=${id}`;
  const row = (rows as { payload: Omit<CasterShare, "id"> }[])[0];
  if (!row) throw new InputError("Ranking snapshot not found.", 404);
  const snapshot = row.payload as Omit<CasterShare, "id">;
  if (
    snapshot.selection.period !== selection.period ||
    snapshot.selection.metric !== selection.metric ||
    snapshot.selection.user !== selection.user
  )
    throw new InputError("Snapshot filters do not match this link.");
  return { id, ...snapshot };
}
