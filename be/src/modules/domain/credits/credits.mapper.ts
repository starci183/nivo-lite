import type { CreditPack, CreditPackPurchase, CreditTopupLot } from "./credits.contracts"
import type { CreditPackEntity, CreditPackPurchaseEntity, CreditTopupEntity } from "./persistence/entities"

/** Maps one pack row to the pack the capability answers. */
export const toCreditPack = (row: CreditPackEntity): CreditPack => ({
    code: row.code,
    credits: row.credits,
    priceVnd: row.priceVnd,
    sort: row.sort,
})

/** Maps an add-on pack purchase to its figures and ISO instant. */
export const toCreditPackPurchase = (row: CreditPackPurchaseEntity): CreditPackPurchase => ({
    credits: row.credits,
    priceVnd: row.priceVnd,
    purchasedAt: row.purchasedAt.toISOString(),
})

/** Maps a purchased lot to its figures and ISO instants. */
export const toCreditTopupLot = (row: CreditTopupEntity): CreditTopupLot => ({
    credits: row.credits,
    priceVnd: row.priceVnd,
    purchasedAt: row.purchasedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    creditsRemaining: row.creditsRemaining,
})
