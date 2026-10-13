/** One row of the loyalty_commands select. */
export interface CommandRow {
    /** The command id; it is also the token that makes a send harmless twice. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** What was asked. */
    readonly kind: string
    /** The parameters, as the caller sent them. */
    readonly params: Readonly<Record<string, unknown>>
    /** queued, done or failed. */
    readonly status: string
    /** The person who asked, or null for a visitor of the public page. */
    readonly created_by: string | null
}
