import { notFound } from "next/navigation";
import { LiveView } from "~~/components/LiveView";
import { liveSelection } from "~~/lib/live-view";
export const metadata = {
  title: "Live View — Faralytics",
  description: "Live captured Farcaster casts, replies, recasts, likes and mentions.",
};
export default async function LiveViewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  let selection;
  try {
    selection = liveSelection(params);
  } catch {
    notFound();
  }
  return <LiveView initialUser={selection.user} initialType={selection.type} initialNow={new Date().toISOString()} />;
}
