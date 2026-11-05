/** Who a promotion is for; a zero, an empty list or false leaves that condition out. */
export interface Segment {
    /** Customers holding one of these tiers. */
    readonly tiers: ReadonlyArray<string>
    /** Customers whose last visit was at least this many days ago (a customer who never bought counts from the day they joined). */
    readonly inactiveDays: number
    /** Customers whose birthday falls in the current month, Vietnam time. */
    readonly birthdayThisMonth: boolean
    /** Customers who spent at least this many VND. */
    readonly minSpendVnd: number
}
