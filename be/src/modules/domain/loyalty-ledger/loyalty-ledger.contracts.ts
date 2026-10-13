import type { EntityManager } from "typeorm"

/** Why points moved. */
export type LedgerKind = "earn" | "redeem" | "expire" | "adjust"

/** One row of the append-only points ledger. */
export interface LedgerEntry {
    /** The entry id. */
    readonly id: string
    /** The customer whose points moved. */
    readonly customerId: string
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added (positive) or taken (negative). */
    readonly points: number
    /** The spend that earned the points, or the cash value of the reward redeemed. */
    readonly amountVnd: number | null
    /** The order behind an earn, or null. */
    readonly orderId: string | null
    /** The idempotency key of the entry. */
    readonly ref: string
    /** Who moved the points: the policy, a person or an API key. */
    readonly by: string
    /** The text that explains the entry. */
    readonly evidence: string | null
    /** The reward behind a redeem, or null. */
    readonly rewardId: string | null
    /** The gate decision behind the entry, or null. */
    readonly workItemId: string | null
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
    /** When the points moved, ISO 8601. */
    readonly occurredAt: string
}

/** A customer with the balance the ledger gives. */
export interface LoyaltyMember {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The phone, normalised, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** The birthday, `YYYY-MM-DD`, or null. */
    readonly birthday: string | null
    /** The key of the held tier, or null. */
    readonly tierKey: string | null
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** The purchases that earned points. */
    readonly visits: number
    /** When the last purchase earned points, ISO 8601, or null. */
    readonly lastVisitAt: string | null
    /** When the customer joined, ISO 8601. */
    readonly joinedAt: string
    /** The note of the owner. */
    readonly note: string
}

/** A member, or null when there is none. */
export type MemberMatch = LoyaltyMember | null

/** The id of a ledger entry written, or null when its key was posted before. */
export type PostedEntry = string | null

/** The part of an entry that decides what is still unspent. */
export interface ExpiryEntry {
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
}

/** What one kind of entry came to over a period. */
export interface LedgerTotal {
    /** The kind of entry. */
    readonly kind: LedgerKind
    /** How many entries. */
    readonly entries: number
    /** The points they moved. */
    readonly points: number
    /** The amounts they carry, in VND. */
    readonly amountVnd: number
}

/** The points an order earns and how they were worked out. */
export interface PointsCalc {
    /** The points earned. */
    readonly points: number
    /** The rate applied, in points per thousand VND. */
    readonly rate: number
    /** The label of the category rule that raised the rate, or empty. */
    readonly label: string
    /** The multiplier of the customer's tier. */
    readonly multiplier: number
    /** The name of the tier that gave the multiplier, or empty. */
    readonly tierName: string
    /** The points added for the visit. */
    readonly perVisit: number
    /** Whether the order was below the smallest one that earns points. */
    readonly belowMinimum: boolean
}

/** What an order is worked out from. */
export interface PurchaseFacts {
    /** The amount paid, in VND. */
    readonly amountVnd: number
    /** The items of the order as text, matched against the category rules. */
    readonly items: string
}

/** The points an entry moves, written inside the transaction of the caller. */
export interface PostParams {
    /** The transaction the entry joins. */
    readonly manager: EntityManager
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly customerId: string
    /** Why the points move. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** The idempotency key: posting it twice changes nothing. */
    readonly ref: string
    /** Who moves the points. */
    readonly by: string
    /** The spend or the cash value behind the entry, or null. */
    readonly amountVnd: number | null
    /** The order behind an earn, or null. */
    readonly orderId: string | null
    /** The invoice behind an earn, or null. */
    readonly invoiceId: string | null
    /** The reward behind a redeem, or null. */
    readonly rewardId: string | null
    /** The text that explains the entry, or null. */
    readonly evidence: string | null
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
    /** When the points moved, ISO 8601. */
    readonly occurredAt: string
}

/** An instant as ISO 8601 text, or null for none. */
export type IsoOrNull = string | null

/** Points that are about to expire and when the first batch does. */
export interface ExpiringSoon {
    /** The points that expire inside the warning window and are still unspent. */
    readonly points: number
    /** When the first batch expires. */
    readonly firstAt: IsoOrNull
}
