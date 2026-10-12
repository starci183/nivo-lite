/** A connection as FIND_INTAKE_CONNECTION selects it. */
export interface IntakeConnectionRow {
    /** The connection id. */
    readonly id: string
    /** The workspace the connection belongs to. */
    readonly workspace_id: string
    /** The connection status. */
    readonly status: string
}
