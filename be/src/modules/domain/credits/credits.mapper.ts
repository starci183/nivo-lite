import type { CreditPack } from "./credits.contracts"
import type { PackRow } from "./persistence/credits.rows"

/** Maps one pack row to the pack the capability answers. */
export const toCreditPack = (row: PackRow): CreditPack => ({
    code: row.code,
    credits: row.credits,
    priceVnd: row.price_vnd,
    sort: row.sort,
})
