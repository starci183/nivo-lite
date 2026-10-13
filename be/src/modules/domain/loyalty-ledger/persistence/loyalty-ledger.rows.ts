import type { ExpiryEntry, LedgerEntry, LedgerKind, LedgerTotal, LoyaltyMember } from "../loyalty-ledger.contracts"

/** One row of the member selects. */
export interface MemberRow {
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

/** One row of the timeline select. */
export interface EntryRow {
    /** The entry id. */
    readonly id: string
    /** The customer. */
    readonly customer_id: string
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** The amount behind the entry. */
    readonly amount_vnd: number | null
    /** The order behind an earn. */
    readonly order_id: string | null
    /** The idempotency key. */
    readonly ref: string
    /** Who moved the points. */
    readonly by_name: string
    /** The explanation. */
    readonly evidence: string | null
    /** The reward behind a redeem. */
    readonly reward_id: string | null
    /** The gate decision behind the entry. */
    readonly work_item_id: string | null
    /** When earned points expire. */
    readonly expires_at: Date | null
    /** When the points moved. */
    readonly occurred_at: Date
}

/** One row of the expiry select. */
export interface ExpiryRow {
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** When earned points expire. */
    readonly expires_at: Date | null
}

/** One row of the totals select. */
export interface TotalRow {
    /** The kind of entry. */
    readonly kind: LedgerKind
    /** How many entries. */
    readonly entries: number
    /** The points they moved. */
    readonly points: number
    /** The amounts they carry. */
    readonly amount_vnd: number
}

/** The member a row holds. */
export const toMember = (row: MemberRow): LoyaltyMember => ({
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

/** The ledger entry a row holds. */
export const toEntry = (row: EntryRow): LedgerEntry => ({
    id: row.id,
    customerId: row.customer_id,
    kind: row.kind,
    points: row.points,
    amountVnd: row.amount_vnd,
    orderId: row.order_id,
    ref: row.ref,
    by: row.by_name,
    evidence: row.evidence,
    rewardId: row.reward_id,
    workItemId: row.work_item_id,
    expiresAt: row.expires_at === null ? null : row.expires_at.toISOString(),
    occurredAt: row.occurred_at.toISOString(),
})

/** The expiry entry a row holds. */
export const toExpiryEntry = (row: ExpiryRow): ExpiryEntry => ({
    kind: row.kind,
    points: row.points,
    expiresAt: row.expires_at === null ? null : row.expires_at.toISOString(),
})

/** The total a row holds. */
export const toTotal = (row: TotalRow): LedgerTotal => ({
    kind: row.kind,
    entries: row.entries,
    points: row.points,
    amountVnd: row.amount_vnd,
})
