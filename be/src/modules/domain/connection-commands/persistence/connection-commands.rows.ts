/** One row of public.connection_commands as the back end reads it. */
export interface ConnectionCommandRow {
    /** The row id. */
    readonly id: string
    /** The workspace the command acts in. */
    readonly workspace_id: string
    /** The member who submitted it. */
    readonly user_id: string
    /** What to run. */
    readonly kind: string
    /** The untrusted fields the kind reads. */
    readonly input: unknown
    /** `pending` until the outcome is written. */
    readonly status: string
}
