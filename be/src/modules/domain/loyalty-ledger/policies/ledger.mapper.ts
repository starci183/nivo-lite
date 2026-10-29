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

/** One member as the grouped select answers it: the customer columns and the balances the ledger gives. */
export interface MemberRaw {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The normalised phone. */
    readonly phone: string | null
    /** The lower-case email. */
    readonly email: string | null
    /** The birthday as text. */
    readonly birthday: string | null
    /** The key of the held tier. */
    readonly tier_key: string | null
    /** When the customer joined. */
    readonly joined_at: Date
    /** The note of the owner. */
    readonly note: string
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

/** The member a grouped row holds. */
export const toMember = (row: MemberRaw): LoyaltyMember => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthday: row.birthday,
    tierKey: row.tier_key,
    points: row.points,
    lifetimeSpendVnd: row.lifetime_spend_vnd,
    visits: row.visits,
    lastVisitAt: row.last_visit_at === null ? null : row.last_visit_at.toISOString(),
    joinedAt: row.joined_at.toISOString(),
    note: row.note,
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
