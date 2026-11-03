/** How one sale is shared. */
export interface RevenueSplit {
    /** The creator share, VND. */
    readonly creator: number
    /** The fee of the platform, VND. */
    readonly platform: number
}

/** Splits a paid amount: the creator gets the whole dong of the percent rounded down, and the platform the rest, so no dong is lost. */
export const splitOf = (amountVnd: number, creatorPct: number): RevenueSplit => {
    const creator = Math.floor((amountVnd * creatorPct) / 100)
    return { creator, platform: amountVnd - creator }
}
