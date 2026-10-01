"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { promo } from "@/i18n/dict/promo";
import { FOUNDING_OFFER } from "@/lib/promo";
import { CD, CD_LABEL, CD_UNIT, CD_VALUE } from "./classNames";

type Left = { days: number; hours: number; minutes: number; seconds: number };

const compute = (now: number): Left => {
  const ms = Math.max(0, Date.parse(FOUNDING_OFFER.endsAt) - now);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
};

const pad = (n: number) => String(n).padStart(2, "0");
const UNITS = [
  ["days", "unitDays"],
  ["hours", "unitHours"],
  ["minutes", "unitMinutes"],
  ["seconds", "unitSeconds"],
] as const;

export type CountdownProps = { readonly date: string };

/** Live Founding 50 countdown to the real end date (ticks after mount, so the server render never mismatches). */
export const OfferCountdown = ({ date }: CountdownProps) => {
  const t = useT(promo);
  const [left, setLeft] = useState<Left | null>(null);
  useEffect(() => {
    const tick = () => setLeft(compute(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={CD} role="timer" aria-label={t("countdownAria", { date })}>
      {UNITS.map(([unit, key]) => (
        <div key={unit} className={CD_UNIT}>
          <span className={CD_VALUE}>{left ? pad(left[unit]) : "--"}</span>
          <span className={CD_LABEL}>{t(key)}</span>
        </div>
      ))}
    </div>
  );
};
