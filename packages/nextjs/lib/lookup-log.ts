import { validFid } from "./activity.ts";

export const LOOKUP_TOOLS = { activity: 2, followers: 10 } as const;
export type LookupTool = keyof typeof LOOKUP_TOOLS;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseLookup(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid lookup.");
  const body = value as Record<string, unknown>;
  if (typeof body.tool !== "string" || !Object.hasOwn(LOOKUP_TOOLS, body.tool)) throw new Error("Unknown tool.");
  const tool = body.tool as LookupTool;
  if (typeof body.lookupId !== "string" || !UUID_PATTERN.test(body.lookupId)) throw new Error("Invalid lookup ID.");
  if (
    !Array.isArray(body.fids) ||
    !body.fids.length ||
    body.fids.length > LOOKUP_TOOLS[tool] ||
    body.fids.some((fid) => typeof fid !== "string" || !validFid(fid)) ||
    new Set(body.fids).size !== body.fids.length
  )
    throw new Error("Invalid viewed FIDs.");
  if (
    typeof body.period !== "string" ||
    (tool === "followers" ? body.period !== "all" : !/^(365|20\d{2})$/.test(body.period))
  )
    throw new Error("Invalid period.");
  if (
    typeof body.end !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.end) ||
    !Number.isFinite(Date.parse(body.end)) ||
    new Date(body.end).toISOString().slice(0, 10) !== body.end
  )
    throw new Error("Invalid end date.");
  return {
    lookupId: body.lookupId.toLowerCase(),
    tool,
    fids: body.fids as string[],
    metadata: { period: body.period, end: body.end },
  };
}
