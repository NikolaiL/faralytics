"use client";
import { useEffect, useState } from "react";

export function CopyToast({ count }: { count: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!count) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [count]);
  return visible ? (
    <div className="copy-toast" role="status" aria-live="polite" aria-atomic="true">
      link copied
    </div>
  ) : null;
}
