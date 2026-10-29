"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>A little interruption.</h1>
      <p>We couldn’t load this chart. Please try again.</p>
      <button onClick={reset}>Try again</button>
      <p>
        <Link href="/">Look up another account ↗</Link>
      </p>
    </main>
  );
}
