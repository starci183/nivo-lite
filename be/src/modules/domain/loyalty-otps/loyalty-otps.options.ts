import type { Secret } from "@modules/platform/config"

/** What the loyalty one-time codes capability needs from the app root. */
export interface LoyaltyOtpsOptions {
    /** The secret mixed into the stored hash of every code, so a stolen table cannot be tried against all six-digit codes. */
    readonly pepper: Secret
}
