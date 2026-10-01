"use client";

import Link from "next/link";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { promo } from "@/i18n/dict/promo";
import { useLocale, useT } from "@/i18n/client";
import { useEffect, useState } from "react";
import { FOUNDING_OFFER as O, isOfferLive } from "@/lib/promo";
import * as c from "./classNames";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

const remaining = (now: number): Remaining => {
  const ms = Math.max(0, Date.parse(O.endsAt) - now);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
};

/** Ticks once a second after mount; null on the server so the first render never mismatches. */
const useCountdown = (): Remaining | null => {
  const [left, setLeft] = useState<Remaining | null>(null);
  useEffect(() => {
    const tick = () => setLeft(remaining(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return left;
};

const STRIP_KEY = "nivo.promo.strip.dismissed";

/** Remembers (in localStorage, best effort) that the owner closed the strip; hidden until read so it never flashes. */
const useStripDismissed = (active: boolean) => {
  const [state, setState] = useState<"unknown" | "shown" | "hidden">("unknown");
  useEffect(() => {
    if (!active) return;
    try {
      setState(window.localStorage.getItem(STRIP_KEY) === "1" ? "hidden" : "shown");
    } catch {
      setState("shown");
    }
  }, [active]);
  return {
    hidden: active && state !== "shown",
    dismiss: () => {
      setState("hidden");
      try {
        window.localStorage.setItem(STRIP_KEY, "1");
      } catch {
        /* storage unavailable: hidden for this visit only */
      }
    },
  };
};

const pad = (n: number) => String(n).padStart(2, "0");
const endLabel = (locale: ReturnType<typeof useLocale>) =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(O.endsAt));

const UNIT_KEYS = { days: "unitDays", hours: "unitHours", minutes: "unitMinutes", seconds: "unitSeconds" } as const;

const Countdown = ({ left, date }: { readonly left: Remaining | null; readonly date: string }) => {
  const t = useT(promo);
  return (
    <div className={c.COUNTDOWN} role="timer" aria-label={t("countdownAria", { date })}>
      {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
        <div key={unit} className={c.UNIT}>
          <span className={c.UNIT_VALUE}>{left ? pad(left[unit]) : "--"}</span>
          <span className={c.UNIT_LABEL}>{t(UNIT_KEYS[unit])}</span>
        </div>
      ))}
    </div>
  );
};

export type FoundingOfferProps = {
  /** hero: full campaign banner · strip: one-line announcement bar · inline: note inside a purchase flow */
  readonly variant?: "hero" | "strip" | "inline" | "pill";
  readonly ctaHref?: string;
};

/**
 * Founding 50 campaign banner with NIVO's unicorn. All copy, dates and the cap come from `@/lib/promo`;
 * the slot counter only renders when the owner has entered a real number.
 */
export const FoundingOffer = ({ variant = "hero", ctaHref = O.ctaHref }: FoundingOfferProps) => {
  const left = useCountdown();
  const dismissed = useStripDismissed(variant === "strip");
  const t = useT(promo);
  const locale = useLocale();
  if (!isOfferLive()) return null;
  const date = endLabel(locale);
  const offerAria = t("offerAria", { name: O.name });
  const cap = O.cap;
  const percent = O.percentOff;
  const conditions = t("conditions", { cap, date });

  if (variant === "pill") {
    return (
      <div className={c.PILL_WRAP} role="note" aria-label={offerAria}>
        <span className={c.PILL_TAG}>{O.name}</span>
        <span className={c.PILL_TEXT}>
          {t("pillText", {
            percent,
            cap,
            ends: left ? t("pillEndsIn", { d: left.days, h: pad(left.hours), m: pad(left.minutes) }) : t("pillEndsOn", { date }),
          })}
        </span>
      </div>
    );
  }

  if (variant === "strip") {
    if (dismissed.hidden) return null;
    return (
      <div className={c.STRIP} role="region" aria-label={offerAria}>
        <span>
          <span className={c.STRIP_STRONG}>{O.name}:</span> {t("stripHeadline", { percent, cap })}
        </span>
        <span className={c.STRIP_META}>{left ? t("endsIn", { d: left.days, h: pad(left.hours), m: pad(left.minutes) }) : t("endsOn", { date })}</span>
        <Link className={c.STRIP_LINK} href={ctaHref}>
          {t("cta")} →
        </Link>
        <button type="button" className={c.STRIP_CLOSE} aria-label={t("adDismiss")} onClick={dismissed.dismiss}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={c.INLINE} role="note">
        <span className={c.INLINE_BADGE}>-{O.percentOff}%</span>
        <div>
          <p className={c.INLINE_TITLE}>
            {t("inlineTitle", { name: O.name, percent, cap })}
          </p>
          <p className={c.INLINE_TEXT}>
            {t("inlineText", { conditions, date })}
          </p>
        </div>
      </div>
    );
  }

  const claimed = O.slotsClaimed;
  return (
    <section className={c.HERO} aria-label={offerAria}>
      <img className={c.HERO_BAND} src="/images/promo/founding50-hero-sm.jpg" alt="" />
      <div className={c.HERO_GRID}>
        <div className={c.HERO_TEXT}>
          <p className={c.EYEBROW}>
            <span className={c.PILL}>{O.name}</span> {t("eyebrow")}
          </p>
          <h2 className={c.HEADLINE}>
            <span className={c.PERCENT}>{t("heroPercent", { percent })}</span> {t("heroRest", { cap })}
          </h2>
          <p className={c.SUBLINE}>{t("subline")}</p>
          <div className={c.ROW}>
            <Link className={c.CTA} href={ctaHref}>
              {t("cta")}
            </Link>
            <Countdown left={left} date={date} />
          </div>
          <p className={c.COUNT_CAPTION}>{t("caption", { date, cap })}</p>
          {claimed !== null ? (
            <>
              <div className={c.METER} role="meter" aria-valuemin={0} aria-valuemax={O.cap} aria-valuenow={claimed}>
                <div className={c.METER_FILL} style={{ width: `${Math.min(100, (claimed / O.cap) * 100)}%` }} />
              </div>
              <p className={c.COUNT_CAPTION}>{t("slotsTaken", { claimed, cap })}</p>
            </>
          ) : null}
          <p className={c.FINE}>{conditions}</p>
        </div>
      </div>
    </section>
  );
};
