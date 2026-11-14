/** Why points moved. */
export type LedgerKind = "earn" | "redeem" | "expire" | "adjust"

/** The part of a ledger entry that decides what is still unspent. */
export interface ExpiryEntry {
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added (positive) or taken (negative). */
    readonly points: number
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
}

/** Points that are about to expire and when the first batch does. */
export interface ExpiringSoon {
    /** The points that expire inside the warning window and are still unspent. */
    readonly points: number
    /** When the first batch expires, ISO 8601, or null. */
    readonly firstAt: string | null
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

/** What an order is worked out from. */
export interface PurchaseFacts {
    /** The amount paid, in VND. */
    readonly amountVnd: number
    /** The items of the order as text, matched against the category rules. */
    readonly items: string
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

/** A customer with the balance the ledger gives, as the statistics and the segments read them. */
export interface LoyaltyMember {
    /** The customer id. */
    readonly id: string
    /** The key of the held tier, or null. */
    readonly tierKey: string | null
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** When the last purchase earned points, ISO 8601, or null. */
    readonly lastVisitAt: string | null
    /** When the customer joined, ISO 8601. */
    readonly joinedAt: string
    /** The birthday, `YYYY-MM-DD`, or null. */
    readonly birthday: string | null
}
