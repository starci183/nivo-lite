/** One generated row of public.connection_secrets. */
export interface ConnectionSecretsRow {
    /** The sealed credential. */
    readonly ciphertext: string
    /** The secret the provider signs its webhooks with. */
    readonly webhook_secret: string
}

/** The columns the service reads of a connection. */
export interface ConnectionSelectRow {
    readonly id: string
    readonly workspace_id: string
    readonly provider: string
    readonly name: string
    readonly public_meta: unknown
    readonly status: string
    readonly last_error: string | null
    readonly environment: string | null
    readonly is_default: boolean | null
    readonly last_event_at: string | null
    readonly first_event: unknown
    readonly created_by: string | null
    readonly created_at: string
}

/** The member columns authorisation reads. */
export interface MemberRow {
    readonly role: string
    readonly display_name: string
}

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
