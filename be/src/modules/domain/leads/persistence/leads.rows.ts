/** public.leads as the statements select it. */
export interface LeadsRow {
    /** The lead row id. */
    readonly id: string
    /** The person to talk to at the prospect. */
    readonly contact_name: string
    /** The organisation the contact belongs to; empty for an individual. */
    readonly company: string
    /** The channel the lead arrived through. */
    readonly channel: string
    /** What the prospect asked for, in their own words. */
    readonly need: string
    /** Whether the lead came from the live workflow or a simulation; null on rows written before origins existed. */
    readonly origin: string | null
    /** The pipeline stage the lead sits in. */
    readonly stage: string
}
