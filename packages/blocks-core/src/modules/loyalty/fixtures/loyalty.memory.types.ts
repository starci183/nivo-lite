/** The contact of a lead the memory world stores for a sync to read. */
export interface LeadSeed {
    /** The name of the lead. */
    readonly contactName: string
    /** The phone, as the lead holds it; absent or null for none. */
    readonly phone?: string | null
    /** The email; absent or null for none. */
    readonly email?: string | null
}
