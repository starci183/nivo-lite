"use client";

import { useCallback, useEffect, useState } from "react";

/** A resend cooldown: `start()` begins a countdown from `seconds`; `left` is 0 when ready. */
export const useCooldown = (seconds: number, startActive = false) => {
  const [left, setLeft] = useState(startActive ? seconds : 0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  const start = useCallback(() => setLeft(seconds), [seconds]);
  return { left, start };
};
