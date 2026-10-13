/** One generated row of public.connection_secrets. */
export interface ConnectionSecretsRow {
    /** The sealed credential. */
    readonly ciphertext: string
    /** The secret the provider signs its webhooks with. */
    readonly webhook_secret: string
}

/** The columns the service reads of a connection. */
export interface ConnectionSelectRow {
    /** The connection row id every command and grant refers to. */
    readonly id: string
    /** The workspace that owns the connection; reads never cross it. */
    readonly workspace_id: string
    /** The provider key that selects the connector behaviour. */
    readonly provider: string
    /** The label the workspace gave the connection. */
    readonly name: string
    /** Provider details safe to show the browser (page ids, sheet urls); untrusted until parsed. */
    readonly public_meta: unknown
    /** The stored lifecycle status, parsed into a connection status before use. */
    readonly status: string
    /** The last failure message shown to the user; null when the connection is healthy. */
    readonly last_error: string | null
    /** `test` or `live`: credits from a test connection are stored as simulated money; null reads as live. */
    readonly environment: string | null
    /** Whether this is the workspace default of its provider; null for providers without a default. */
    readonly is_default: boolean | null
    /** When the provider last delivered an event, ISO text; null when it never has. */
    readonly last_event_at: string | null
    /** The first delivered event kept as proof the webhook works; untrusted until parsed. */
    readonly first_event: unknown
    /** The member who created the connection; null for system-created ones. */
    readonly created_by: string | null
    /** When the connection was created, ISO text. */
    readonly created_at: string
}

/** The member columns authorisation reads. */
export interface MemberRow {
    /** The member's workspace role, which decides what they may change. */
    readonly role: string
    /** The member's name, handed back so callers can name who acted. */
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
