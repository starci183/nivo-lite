/** public.workspace_invites as the team page lists it. */
export interface PendingInviteRow {
    /** The invitation id. */
    id: string
    /** The invited address. */
    email: string
    /** The staff row it links, when any. */
    staff_id: string | null
    /** When it was issued. */
    created_at: string
    /** When the link stops working. */
    expires_at: string
    /** Constrained by a CHECK in the table. */
    role: "manager" | "staff"
}

/** public.workspace_invites as acceptance judges it. */
export interface InviteRow {
    /** The invitation id. */
    id: string
    /** The workspace it belongs to. */
    workspace_id: string
    /** The invited address. */
    email: string
    /** The role it grants. */
    role: string
    /** The staff row it links, when any. */
    staff_id: string | null
    /** Set once accepted. */
    accepted_at: string | null
    /** Set once revoked. */
    revoked_at: string | null
    /** When the link stops working. */
    expires_at: string
}

/** The invitation fields a rotation or a revocation answers. */
export interface ChangedInviteRow {
    /** The invitation id. */
    id: string
    /** The invited address. */
    email: string
    /** The role it grants. */
    role: string
}

/** The invitation preview row. */
export interface InvitePreviewRow {
    /** The name of the workspace the invitation is for. */
    workspace_name: string
    /** The invited address. */
    email: string
    /** The role it grants. */
    role: string
    /** The name of the staff row it links, when any. */
    staff_name: string | null
    /** `pending`, `revoked`, `accepted` or `expired`. */
    state: string
}

/** A freshly minted invitation token. */
export interface MintedTokenRow {
    /** The raw token, shown once inside the invitation link. */
    token: string
}

/** The id of a staff-held invitation. */
export interface HeldRow {
    /** The invitation id. */
    id: string
}
