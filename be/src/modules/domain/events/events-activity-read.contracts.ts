/** The instant of the newest evidence line about a customer. */
export interface LeadActivity {
    /** The customer. */
    readonly lead_id: string
    /** When the newest line about the customer was logged. */
    readonly last_at: Date
}
