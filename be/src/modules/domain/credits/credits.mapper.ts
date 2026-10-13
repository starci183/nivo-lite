import type { CreditPack, CreditPackPurchase, CreditTopupLot } from "./credits.contracts"
import type { PackPurchaseRow, PackRow, TopupLotRow } from "./persistence/credits.rows"

/** Maps one pack row to the pack the capability answers. */
export const toCreditPack = (row: PackRow): CreditPack => ({
    code: row.code,
    credits: row.credits,
    priceVnd: row.price_vnd,
    sort: row.sort,
})

/** Maps an add-on pack purchase to its figures and ISO instant. */
export const toCreditPackPurchase = (row: PackPurchaseRow): CreditPackPurchase => ({
    credits: row.credits,
    priceVnd: row.price_vnd,
    purchasedAt: new Date(row.purchased_at).toISOString(),
})

/** Maps a purchased lot to its figures and ISO instants. */
export const toCreditTopupLot = (row: TopupLotRow): CreditTopupLot => ({
    credits: row.credits,
    priceVnd: row.price_vnd,
    purchasedAt: new Date(row.purchased_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    creditsRemaining: row.credits_remaining,
})
