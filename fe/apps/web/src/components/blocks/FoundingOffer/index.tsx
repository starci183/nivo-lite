"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useDismissal, useFoundingOffer, usePromoCountdown } from "@/hooks/promo"
import { FoundingOfferBase } from "./component"

/** Which campaign presentation to draw. */
type FoundingOfferProps = {
    /** hero: full campaign banner, strip: one-line announcement bar, inline: note inside a purchase flow, pill: badge with one line. */
    readonly variant?: "hero" | "strip" | "inline" | "pill"
    readonly ctaHref?: string
}

const STRIP_KEY = "nivo.promo.strip.dismissed"

const UNIT_KEYS = { days: "unitDays", hours: "unitHours", minutes: "unitMinutes", seconds: "unitSeconds" } as const

const pad = (value: number): string => String(value).padStart(2, "0")

/** The campaign blocks. Numbers, dates and the cap come from the offer config; every sentence comes from the catalog. */
export const FoundingOffer = (props: FoundingOfferProps) => {
    const variant = props.variant ?? "hero"
    const { offer, isLive } = useFoundingOffer()
    const t = useTranslations("promo")
    const format = useFormatter()
    const left = usePromoCountdown(offer.endsAt)
    const strip = useDismissal(STRIP_KEY, variant === "strip")
    if (!isLive || strip.isHidden) return null
    const date = format.dateTime(new Date(offer.endsAt), { day: "numeric", month: "short", year: "numeric" })
    const { cap, name, percentOff: percent } = offer
    const ends = left ? { d: left.days, h: pad(left.hours), m: pad(left.minutes) } : null
    const conditions = t("conditions", { cap, date })
    return (
        <FoundingOfferBase
            state={variant}
            props={{
                name,
                ctaHref: props.ctaHref ?? offer.ctaHref,
                cta: t("cta"),
                offerAria: t("offerAria", { name }),
                pillText: t("pillText", {
                    percent,
                    cap,
                    ends: ends ? t("pillEndsIn", ends) : t("pillEndsOn", { date }),
                }),
                stripTitle: `${name}: ${t("stripHeadline", { percent, cap })}`,
                stripEnds: ends ? t("endsIn", ends) : t("endsOn", { date }),
                dismissLabel: t("adDismiss"),
                inlineTitle: t("inlineTitle", { name, percent, cap }),
                inlineText: t("inlineText", { conditions, date }),
                heroEyebrow: `${name} ${t("eyebrow")}`,
                heroTitle: `${t("heroPercent", { percent })} ${t("heroRest", { cap })}`,
                subline: t("subline"),
                caption: t("caption", { date, cap }),
                conditions,
                countdownAria: t("countdownAria", { date }),
                units: (["days", "hours", "minutes", "seconds"] as const).map((unit) => ({
                    id: unit,
                    term: t(UNIT_KEYS[unit]),
                    value: left ? pad(left[unit]) : "--",
                })),
                slots:
                    offer.slotsClaimed === null
                        ? null
                        : {
                              claimed: offer.slotsClaimed,
                              cap,
                              label: t("slotsTaken", { claimed: offer.slotsClaimed, cap }),
                          },
            }}
            on={{ dismiss: strip.dismiss }}
        />
    )
}
