/** One generated row of public.connection_secrets. */
export interface ConnectionSecretsRow {
    /** The sealed credential. */
    readonly ciphertext: string
    /** The secret the provider signs its webhooks with. */
    readonly webhook_secret: string
}

/** The columns the service reads of a connection. */
export interface ConnectionSelectRow {
    /** The connection id. */
    readonly id: string
    /** The workspace that owns the connection. */
    readonly workspace_id: string
    /** The provider key stored for the connection. */
    readonly provider: string
    /** The name the owner gave the connection. */
    readonly name: string
    /** Non-secret facts stored as JSON. */
    readonly public_meta: unknown
    /** Where the connection is in its life. */
    readonly status: string
    /** The last failure shown to the owner, or null. */
    readonly last_error: string | null
    /** Test or live, or null when the row predates the column. */
    readonly environment: string | null
    /** Whether this SMTP connection is the workspace default, or null. */
    readonly is_default: boolean | null
    /** When the last event arrived, ISO 8601, or null. */
    readonly last_event_at: string | null
    /** The first accepted event as JSON, or null. */
    readonly first_event: unknown
    /** Who created the connection, or null. */
    readonly created_by: string | null
    /** When the connection was created, ISO 8601. */
    readonly created_at: string
}

/** The member columns authorisation reads. */
export interface MemberRow {
    /** The role the member holds in the workspace. */
    readonly role: string
    /** The name shown in audit trails. */
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

/** The sync schedule columns of a connection. */
export interface SyncScheduleRow {
    /** Minutes between two scheduled syncs; null is manual only. */
    readonly sync_every_minutes: number | null
    /** When the last sync finished, ISO 8601 text; null when none did. */
    readonly last_sync_at: string | null
}
