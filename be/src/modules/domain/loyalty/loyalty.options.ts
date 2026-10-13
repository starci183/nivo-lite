import type { CodeDelivery } from "./loyalty.contracts"

/** What the loyalty capability needs from the app root. */
export interface LoyaltyOptions {
    /** Carries the one-time code of the public points check into the chat of a customer. */
    readonly delivery: CodeDelivery
}
