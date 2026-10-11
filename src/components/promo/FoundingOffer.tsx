"use client";

import { Alert, Badge, Button, DescriptionList, Image, Meter, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
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

/** The four units are key figures side by side: Grammar's stat strip (term = unit, description = value; HIERARCHY-3). */
const Countdown = ({ left, date }: { readonly left: Remaining | null; readonly date: string }) => {
  const t = useT(promo);
  return (
    <div className={c.HERO_COUNTDOWN} role="timer" aria-label={t("countdownAria", { date })}>
      <DescriptionList
        layout="stat-strip"
        isDivided
        items={(["days", "hours", "minutes", "seconds"] as const).map((unit) => ({
          id: unit,
          term: t(UNIT_KEYS[unit]),
          description: left ? pad(left[unit]) : "--",
        }))}
      />
    </div>
  );
};

export type FoundingOfferProps = {
  /** hero: full campaign banner · strip: one-line announcement bar · inline: note inside a purchase flow */
  readonly variant?: "hero" | "strip" | "inline" | "pill";
  readonly ctaHref?: string;
};

/**
 * Founding 50 campaign blocks. All copy, dates and the cap come from `@/lib/promo`; the slot counter only renders
 * when the owner has entered a real number.
 * - hero: the screen's one signature moment, Grammar's ink band (`SurfaceCard treatment="ink"`) with the offer
 *   unicorn in its decorative artwork slot (DISCIPLINE-3).
 * - strip / inline: notices, so the DNA `Alert` carries them (ACCENT-5 case-5, DISCIPLINE-1 case-5).
 * - pill: a `Badge` naming the campaign beside one muted line.
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
        <Badge tone="accent">{O.name}</Badge>
        <Text size="sm" tone="muted">
          {t("pillText", {
            percent,
            cap,
            ends: left ? t("pillEndsIn", { d: left.days, h: pad(left.hours), m: pad(left.minutes) }) : t("pillEndsOn", { date }),
          })}
        </Text>
      </div>
    );
  }

  if (variant === "strip") {
    if (dismissed.hidden) return null;
    return (
      <div className={c.STRIP} role="region" aria-label={offerAria}>
        <Alert
          tone="informative"
          title={`${O.name}: ${t("stripHeadline", { percent, cap })}`}
          description={
            <>
              {left ? t("endsIn", { d: left.days, h: pad(left.hours), m: pad(left.minutes) }) : t("endsOn", { date })}{" "}
              {/* A destination, so a TextAction with href rather than the Alert's command action (CTA-2). */}
              <TextAction href={ctaHref} appearance="inline">
                {t("cta")}
              </TextAction>
            </>
          }
          dismissLabel={t("adDismiss")}
          onDismiss={dismissed.dismiss}
        />
      </div>
    );
  }

  if (variant === "inline") {
    return <Alert tone="informative" title={t("inlineTitle", { name: O.name, percent, cap })} description={t("inlineText", { conditions, date })} />;
  }

  const claimed = O.slotsClaimed;
  return (
    <SurfaceCard
      treatment="ink"
      ariaLabel={offerAria}
      artwork={<Image src="/images/promo/mascot-offer.png" alt="" aspect="auto" fit="contain" />}
    >
      <div className={c.HERO_COPY}>
        <SectionHeader
          eyebrow={`${O.name} ${t("eyebrow")}`}
          title={`${t("heroPercent", { percent })} ${t("heroRest", { cap })}`}
          description={t("subline")}
        />
        <div className={c.HERO_ROW}>
          {/* grammar gap: a primary Button on the ink band is accent on accent; secondary until an on-ink primary ships. */}
          <Button variant="secondary" href={ctaHref}>
            {t("cta")}
          </Button>
          <Countdown left={left} date={date} />
        </div>
        <Text size="xs">{t("caption", { date, cap })}</Text>
        {claimed !== null ? (
          <Meter label={t("slotsTaken", { claimed, cap })} value={claimed} minValue={0} maxValue={O.cap} valueLabel={`${claimed}/${O.cap}`} />
        ) : null}
        <Text size="xs">{conditions}</Text>
      </div>
    </SurfaceCard>
  );
};
