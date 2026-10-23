/** One person of the programme: ONE record however many leads and chats they have. */
export interface LoyaltyCustomer {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The phone, normalised to the `84` form, or null. */
    readonly phone: string | null
    /** The email, lower case, or null. */
    readonly email: string | null
    /** The birthday, `YYYY-MM-DD`, or null. */
    readonly birthday: string | null
    /** The key of the tier the customer holds, or null before the first purchase. */
    readonly tierKey: string | null
    /** When the customer joined, ISO 8601. */
    readonly joinedAt: string
    /** The note of the owner. */
    readonly note: string
}

/** What is known about a person who is about to become a customer. */
export interface NewLoyaltyCustomer {
    /** The workspace. */
    readonly workspaceId: string
    /** The name to call the customer by. */
    readonly name: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** The birthday, `YYYY-MM-DD`, or null. */
    readonly birthday: string | null
}

/** A lead whose contact can make it a customer. */
export interface LeadContact {
    /** The lead id. */
    readonly id: string
    /** The name of the contact. */
    readonly name: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
}

/** A customer, or null when there is none. */
export type CustomerMatch = LoyaltyCustomer | null

/** A text that may be missing: a phone, an email or an id. */
export type MaybeText = string | null

/** A profile birthday as a calendar date, or null when absent. */
export type CustomerBirthday = string | null

/** The profile fields an owner may change without changing a customer's identity or balance. */
export interface CustomerPatch {
    /** The name, when changed. A blank name leaves the existing name. */
    readonly name?: string
    /** The birthday, when changed; null clears it. */
    readonly birthday?: CustomerBirthday | undefined
    /** The owner's note, when changed. */
    readonly note?: string
}
