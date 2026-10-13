/** The columns the console shows of an audit row. */
export interface AuditRow {
    /** The row id. */
    readonly id: string
    /** The admin email. */
    readonly actor_email: string
    /** What happened. */
    readonly action: string
    /** The workspace it concerned, when any. */
    readonly workspace_id: string | null
    /** When it happened. */
    readonly created_at: string
}
