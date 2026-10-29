import Link from "next/link";
export default function NotFound() {
  return (
    <main>
      <h1>That page wandered off.</h1>
      <Link href="/">Back to Faralytics ↗</Link>
    </main>
  );
}
