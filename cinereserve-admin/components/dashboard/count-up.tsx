"use client";

import { useEffect, useRef, useState } from "react";

const whole = (n: number) => Math.round(n).toLocaleString("en-US");

/** "₱12,345.67" while counting, so the width settles to the final format. */
export const pesoCount = (n: number) =>
  `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Counts up to `value` (from 0 on first load, then from the last shown
 * number), easing out so it slows as it lands. Jumps straight to the value
 * when the viewer prefers reduced motion.
 */
export function CountUp({
  value,
  format = whole,
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = ms ? Math.min(1, (now - start) / ms) : 1;
      const next = from + (value - from) * (1 - (1 - t) ** 3);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
