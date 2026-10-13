/** The Founding 50 campaign facts. */
interface FoundingOffer {
    readonly enabled: boolean
    readonly name: string
    readonly percentOff: number
    readonly cap: number
    readonly startsAt: string
    readonly endsAt: string
    /** The real number of founding slots taken, set by the owner; null hides the counter and the number is never guessed. */
    readonly slotsClaimed: number | null
    readonly ctaHref: string
}

/** The Founding 50 campaign: its numbers, its window and where it leads. Wording lives in the promo catalogs; the owner confirms every figure before it is published. */
export const FOUNDING_OFFER: FoundingOffer = {
    enabled: true,
    name: "Founding 50",
    percentOff: 50,
    cap: 50,
    startsAt: "2026-09-29T00:00:00+07:00",
    endsAt: "2026-10-31T23:59:59+07:00",
    slotsClaimed: null,
    ctaHref: "/modules/new?module=chatbot",
}

/** True while the campaign is switched on and `now` (epoch milliseconds) is inside its window. */
export const isOfferLive = (now = Date.now()): boolean =>
    FOUNDING_OFFER.enabled && now >= Date.parse(FOUNDING_OFFER.startsAt) && now <= Date.parse(FOUNDING_OFFER.endsAt)

/** The storage key of a dismissed promo card. */
export const dismissKey = (id: string): string => `nivo.promo.dismissed.${id}`

/** One onboarding step; `done` comes from real rows and events only. */
export interface OnboardingStep {
    /** The stable key of the step. */
    readonly key: string
    /** What the step is. */
    readonly label: string
    /** Why it matters. */
    readonly hint: string
    /** Whether the workspace already did it. */
    readonly done: boolean
    /** Where the step is done. */
    readonly href: string
    /** The text of the button that goes there. */
    readonly cta: string
}
