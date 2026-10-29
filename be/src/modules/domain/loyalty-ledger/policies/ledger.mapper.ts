import type { LoyaltyCustomer } from "@modules/domain/loyalty-customers"
import type { ExpiryEntry, LedgerEntry, LedgerTotal, LoyaltyMember } from "../loyalty-ledger.contracts"
import type { LoyaltyLedgerEntity } from "../persistence/entities"

/** The ledger columns an entry of the timeline carries. */
export type EntryFields = Pick<
    LoyaltyLedgerEntity,
    | "id"
    | "customerId"
    | "kind"
    | "points"
    | "amountVnd"
    | "orderId"
    | "ref"
    | "byName"
    | "evidence"
    | "rewardId"
    | "workItemId"
    | "expiresAt"
    | "occurredAt"
>

/** The ledger columns an expiry entry carries. */
export type ExpiryFields = Pick<LoyaltyLedgerEntity, "kind" | "points" | "expiresAt">

/** The balances the ledger gives one customer, as the grouped select answers them. */
export interface BalanceRaw {
    /** The customer id. */
    readonly customer_id: string
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points. */
    readonly lifetime_spend_vnd: number
    /** The purchases that earned points. */
    readonly visits: number
    /** When the last earn happened. */
    readonly last_visit_at: Date | null
}

/** One kind of entry as the totals select answers it. */
export interface TotalRaw {
    /** The kind of entry. */
    readonly kind: LedgerTotal["kind"]
    /** How many entries. */
    readonly entries: number
    /** The points they moved. */
    readonly points: number
    /** The amounts they carry. */
    readonly amount_vnd: number
}

/** The member a customer and the balances of the ledger make; a customer the ledger has no entry for holds nothing. */
export const toMember = (customer: LoyaltyCustomer, balance: BalanceRaw | undefined): LoyaltyMember => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    birthday: customer.birthday,
    tierKey: customer.tierKey,
    points: balance?.points ?? 0,
    lifetimeSpendVnd: balance?.lifetime_spend_vnd ?? 0,
    visits: balance?.visits ?? 0,
    lastVisitAt: balance?.last_visit_at?.toISOString() ?? null,
    joinedAt: customer.joinedAt,
    note: customer.note,
})

/** The ledger entry a stored row holds. */
export const toEntry = (row: EntryFields): LedgerEntry => ({
    id: row.id,
    customerId: row.customerId,
    kind: row.kind,
    points: row.points,
    amountVnd: row.amountVnd,
    orderId: row.orderId,
    ref: row.ref,
    by: row.byName,
    evidence: row.evidence,
    rewardId: row.rewardId,
    workItemId: row.workItemId,
    expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
    occurredAt: row.occurredAt.toISOString(),
})

/** The expiry entry a stored row holds. */
export const toExpiryEntry = (row: ExpiryFields): ExpiryEntry => ({
    kind: row.kind,
    points: row.points,
    expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
})

/** The total a grouped row holds. */
export const toTotal = (row: TotalRaw): LedgerTotal => ({
    kind: row.kind,
    entries: row.entries,
    points: row.points,
    amountVnd: row.amount_vnd,
})
