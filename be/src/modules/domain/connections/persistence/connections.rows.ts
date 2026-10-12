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
