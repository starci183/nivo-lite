/** One row of public.be_account_sessions. */
export interface SessionRow {
    /** The Auth session id. */
    id: string
    /** When it was created. */
    created_at: Date | string | null
    /** When it was last active. */
    last_active_at: Date | string | null
    /** The raw user agent. */
    user_agent: string | null
    /** The address the session came from. */
    ip: string | null
}

/** One row of public.be_account_providers. */
export interface ProviderRow {
    /** The identity provider name. */
    provider: string
}

/** The answer of public.be_revoke_session. */
export interface RevokedRow {
    /** True when a session of the person was deleted. */
    revoked: boolean
}
