export { FOUNDING_OFFER, isOfferLive } from "@nivo-lite/offer"

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
