import type { Metadata } from "next";
import { StatsDashboard } from "~~/components/StatsDashboard";
export const metadata: Metadata = {
  title: "Lookup stats — Faralytics",
  robots: { index: false, follow: false },
};
export default function StatsPage() {
  return <StatsDashboard />;
}
