import type { LeadContact, LoyaltyCustomer } from "../loyalty-customers.contracts"
import type { LoyaltyCustomerEntity } from "../persistence/entities"
import { toLoyaltyEmail, toLoyaltyPhone } from "./contact.policy"

/** The columns of a customer the contract carries. */
export type CustomerFields = Pick<
    LoyaltyCustomerEntity,
    "id" | "name" | "phone" | "email" | "birthday" | "tierKey" | "joinedAt" | "note"
>

/** One lead contact as the leads select answers it (the leads table belongs to another capability). */
export interface LeadContactRaw {
    /** The lead id. */
    readonly id: string
    /** The name of the contact. */
    readonly contact_name: string
    /** The phone of the lead. */
    readonly phone: string | null
    /** The email of the lead. */
    readonly email: string | null
}

/** The customer a stored row stands for. */
export const toCustomer = (row: CustomerFields): LoyaltyCustomer => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthday: row.birthday,
    tierKey: row.tierKey,
    joinedAt: row.joinedAt.toISOString(),
    note: row.note,
})

/** The lead contact a lead row holds, with its phone and email normalised. */
export const toLeadContact = (row: LeadContactRaw): LeadContact => ({
    id: row.id,
    name: row.contact_name,
    phone: toLoyaltyPhone(row.phone),
    email: toLoyaltyEmail(row.email),
})
