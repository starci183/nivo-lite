import { FOUNDING_OFFER } from "@/lib/promo"

/**
 * Commercial values shown on the landing page.
 * TO_CONFIRM: every number below is a snapshot from the NIVO.VN template, not a confirmed offer.
 * The owner must confirm price and trial length before the page is published.
 * The Founding 50 percent, cap and dates come from the promo module (also TO_CONFIRM there).
 */
export const LANDING_OFFER = {
    /** TO_CONFIRM: NIVO Start monthly price in VND. */
    startPriceVnd: 499_000,
    /** TO_CONFIRM: free trial length in days. */
    trialDays: 7,
    /** TO_CONFIRM: whether a card is needed to start the trial. */
    cardRequired: false,
} as const

/** The page anchors the nav, the hero and the footer scroll to. */
export const LANDING_ANCHORS = {
    top: "#top",
    product: "#product",
    how: "#how",
    founding: "#founding",
    commitment: "#commitment",
    faq: "#faq",
} as const

export { FOUNDING_OFFER, isOfferLive } from "@/lib/promo"

/** Founding 50 price: base price minus the campaign percent, rounded to the nearest thousand dong. */
export const foundingPriceVnd = (): number =>
    Math.round((LANDING_OFFER.startPriceVnd * (100 - FOUNDING_OFFER.percentOff)) / 100 / 1000) * 1000
