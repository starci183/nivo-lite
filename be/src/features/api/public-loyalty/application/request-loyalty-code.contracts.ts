/** What request-loyalty-code takes. */
export interface RequestLoyaltyCodeRequest {
    /** The slug. */
    readonly slug: string
    /** The phone. */
    readonly phone: string
}

/** What request-loyalty-code answers. */
export interface RequestLoyaltyCodeResult {
    /** The ok. */
    readonly ok: boolean
    /** The code. */
    readonly code: "none" | "bad_phone" | "closed" | "busy" | "wrong"
}
