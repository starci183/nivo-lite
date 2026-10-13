import type { CreditPack, TopupLot } from "./credits.contracts"
import type { LotRow, PackRow } from "./persistence/credits.rows"

/** Maps one pack row to the pack the capability answers. */
export const toCreditPack = (row: PackRow): CreditPack => ({
    code: row.code,
    credits: row.credits,
    priceVnd: row.price_vnd,
    sort: row.sort,
})

/** Maps one top-up lot row, its instants as ISO text. */
export const toTopupLot = (row: LotRow): TopupLot => ({
    credits: row.credits,
    priceVnd: row.price_vnd,
    purchasedAt: new Date(row.purchased_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    creditsRemaining: row.credits_remaining,
})
