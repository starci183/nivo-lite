/** The columns a job reads of a command it starts. */
export interface AppCommandRow {
    /** The command id. */
    readonly id: string
    /** The workspace it concerns. */
    readonly workspace_id: string | null
    /** The person who asked. */
    readonly requested_by: string
    /** What was asked. */
    readonly kind: string
    /** What the asker typed. */
    readonly input: unknown
}
