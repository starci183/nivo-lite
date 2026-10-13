"use client"

import { useFormatter, useTranslations } from "next-intl"
import { FOUNDING_OFFER, LANDING_OFFER, foundingPriceVnd, isOfferLive, useCountdown } from "@/hooks/landing"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LandingOfferBase } from "./component"

/** Two digits, so the strip does not change width as a number ticks down. */
const pad = (value: number | undefined): string => (value === undefined ? "--" : String(value).padStart(2, "0"))

/** The landing offer section; the countdown ticks in the browser, so the block is a client block. */
export const LandingOffer = () => {
    const t = useTranslations("landingBottom")
    const promo = useTranslations("promo")
    const format = useFormatter()
    const left = useCountdown(FOUNDING_OFFER.endsAt)
    const money = (amount: number): string =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const live = isOfferLive()
    const endsOn = format.dateTime(new Date(FOUNDING_OFFER.endsAt), { day: "numeric", month: "short", year: "numeric" })
    const card = LANDING_OFFER.cardRequired ? t("fact2Card") : t("fact2NoCard")
    return (
        <LandingOfferBase
            props={{
                regionLabel: t("offerAria"),
                eyebrow: t("offerEyebrow"),
                title: t("offerTitle"),
                leftFacts: [
                    { id: "scope", icon: "review", title: t("fact1Title"), text: t("fact1Text") },
                    {
                        id: "trial",
                        icon: "pending",
                        title: t("fact2Title", { days: LANDING_OFFER.trialDays }),
                        text: t("fact2Text", { card }),
                    },
                ],
                rightFacts: [
                    { id: "support", icon: "support", title: t("fact3Title"), text: t("fact3Text") },
                    { id: "account", icon: "account", title: t("fact4Title"), text: t("fact4Text") },
                ],
                priceLabel: t("priceLabel"),
                planName: t("planName"),
                price: money(live ? foundingPriceVnd() : LANDING_OFFER.startPriceVnd),
                perMonth: t("perMonth"),
                priceNote: live ? t("foundingPriceLabel") : t("priceAfterTrial"),
                campaign: live
                    ? {
                          tag: t("foundingTag"),
                          basePrice: money(LANDING_OFFER.startPriceVnd),
                          saving: t("foundingSaving", {
                              percent: FOUNDING_OFFER.percentOff,
                              cap: FOUNDING_OFFER.cap,
                          }),
                          endsText: t("offerEnds", { date: endsOn }),
                          countdownLabel: promo("countdownAria", { date: endsOn }),
                          countdown: [
                              { id: "days", term: promo("unitDays"), value: pad(left?.days) },
                              { id: "hours", term: promo("unitHours"), value: pad(left?.hours) },
                              { id: "minutes", term: promo("unitMinutes"), value: pad(left?.minutes) },
                              { id: "seconds", term: promo("unitSeconds"), value: pad(left?.seconds) },
                          ],
                      }
                    : null,
                ctaLabel: t("offerCta"),
                ctaHref: CONSOLE_ROUTES.login,
                fine: t("offerFine"),
            }}
        />
    )
}
