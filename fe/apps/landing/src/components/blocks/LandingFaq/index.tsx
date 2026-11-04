"use client"

import { useFormatter, useTranslations } from "next-intl"
import { FOUNDING_OFFER, LANDING_OFFER } from "@/hooks/landing"
import { LandingFaqBase } from "./component"

import type { ReactElement } from "react"

/** Values the answers quote, by the placeholder names the catalog uses. */
type FaqValues = Record<string, string | number>

/** The landing FAQ with its copy and quoted numbers resolved here; its accordions open in the browser, so the block is a client block. */
export const LandingFaq = (): ReactElement => {
    const t = useTranslations("landingBottom")

    const format = useFormatter()
    const terms: FaqValues = {
        percent: FOUNDING_OFFER.percentOff,
        cap: FOUNDING_OFFER.cap,
        date: format.dateTime(new Date(FOUNDING_OFFER.endsAt), { day: "numeric", month: "short", year: "numeric" }),
    }
    const price: FaqValues = {
        plan: t("planName"),
        price: format.number(LANDING_OFFER.startPriceVnd, {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0,
        }),
        days: LANDING_OFFER.trialDays,
    }
    const entry = (n: number, values?: FaqValues) => ({
        id: `q${n}`,
        question: t(`q${n}`),
        answer: t(`a${n}`, values),
    })
    return (
        <LandingFaqBase
            props={{
                regionLabel: t("faqAria"),
                eyebrow: t("faqEyebrow"),
                title: t("faqTitle"),
                leftLabel: t("faqListLeft"),
                rightLabel: t("faqListRight"),
                left: [entry(1), entry(2), entry(3), entry(4, terms)],
                right: [entry(5), entry(6), entry(7, price), entry(8)],
                openFirstId: "q1",
            }}
        />
    )
}
