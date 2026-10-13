/** One customer of the public API. */
export class LeadResponse {
    /** The customer id. */
    id!: string
    /** The customer's name. */
    name!: string
    /** The company. */
    company!: string
    /** The channel. */
    channel!: string
    /** What the customer needs. */
    need!: string
    /** The stage. */
    stage!: string
    /** The phone number, or null. */
    phone!: string | null
    /** The email address, or null. */
    email!: string | null
    /** When the customer was created, ISO 8601. */
    created_at!: string
}

/** The HTTP response of GET /api/v1/leads: the public API wraps its payload in `data`. */
export class ListLeadsResponse {
    /** The customers, newest first. */
    data!: Array<LeadResponse>
}
