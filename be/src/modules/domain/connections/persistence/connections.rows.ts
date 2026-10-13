/** A connection as FIND_INTAKE_CONNECTION selects it. */
export interface IntakeConnectionRow {
    /** The connection id. */
    readonly id: string
    /** The workspace the connection belongs to. */
    readonly workspace_id: string
    /** The connection status. */
    readonly status: string
}

/** A connection as LIST_HEALTH_BATCH selects it. */
export interface HealthCandidateRow {
    /** The connection id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The provider key. */
    readonly provider: string
    /** The connection name. */
    readonly name: string
    /** The connection status. */
    readonly status: string
    /** The last error, empty when none. */
    readonly last_error: string
    /** The last event time as text, empty when never. */
    readonly last_event_at: string
    /** The creation time as text. */
    readonly created_at: string
    /** The recorded health state, empty when none. */
    readonly health: string
}

/** A connection as FIND_SMTP_CONNECTION selects it. */
export interface SmtpConnectionRow {
    /** The connection id. */
    readonly id: string
    /** The public facts of the connection: host, port, security, user, sender. */
    readonly public_meta: Record<string, string> | null
}
