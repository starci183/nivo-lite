/** One row of public.api_keys. */
export interface ApiKeysRow {
    /** The agent the key acts as on the MCP endpoint, or null for a public API key. */
    agent_id: string | null
    /** When the key was created. */
    created_at: string
    /** The user who created the key, or null. */
    created_by: string | null
    /** The key id. */
    id: string
    /** The hash used to authenticate the key. */
    key_hash: string
    /** The visible key prefix. */
    key_prefix: string
    /** When the key was last used, or null. */
    last_used_at: string | null
    /** The key display name. */
    name: string
    /** When the key was revoked, or null. */
    revoked_at: string | null
    /** The scopes granted to the key. */
    scopes: Array<string>
    /** The workspace that owns the key. */
    workspace_id: string
}

/** One row of public.workspace_members. */
export interface MemberRow {
    /** When the membership was created. */
    created_at: string
    /** The member display name. */
    display_name: string
    /** The membership id. */
    id: string
    /** The member role in the workspace. */
    role: string
    /** The linked staff id, or null. */
    staff_id: string | null
    /** The membership status. */
    status: string
    /** The member user id. */
    user_id: string
    /** The workspace the member belongs to. */
    workspace_id: string
}
