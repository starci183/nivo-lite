/** public.leads as the statements select it. */
export interface LeadsRow {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company the customer named. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** `live`, `simulated`, or null. */
    readonly origin: string | null
    /** The stage of the lead. */
    readonly stage: string
}
