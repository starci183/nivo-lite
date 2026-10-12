import type { LeadContact, LoyaltyCustomer } from "../loyalty-customers.contracts"
import { toLoyaltyEmail, toLoyaltyPhone } from "../policies/contact.policy"

/** One row of the customer selects. */
export interface CustomerRow {
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
}

/** One row of the lead contacts select. */
export interface LeadContactRow {
    /** The lead id. */
    readonly id: string
    /** The name of the contact. */
    readonly contact_name: string
    /** The phone of the lead. */
    readonly phone: string | null
    /** The email of the lead. */
    readonly email: string | null
}

/** The customer a row holds. */
export const toCustomer = (row: CustomerRow): LoyaltyCustomer => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthday: row.birthday,
    tierKey: row.tier_key,
    joinedAt: row.joined_at.toISOString(),
    note: row.note,
})

/** The lead contact a row holds, with its phone and email normalised. */
export const toLeadContact = (row: LeadContactRow): LeadContact => ({
    id: row.id,
    name: row.contact_name,
    phone: toLoyaltyPhone(row.phone),
    email: toLoyaltyEmail(row.email),
})
