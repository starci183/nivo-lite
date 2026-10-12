import type { Database } from "../../../../../../supabase/types/database.types"

type Row = Database["public"]["Tables"]["workspace_invites"]["Row"]

/** public.workspace_invites as the team page lists it. */
export type PendingInviteRow = Pick<Row, "id" | "email" | "staff_id" | "created_at" | "expires_at"> & {
    /** Constrained by a CHECK in the table. */
    role: "manager" | "staff"
}

/** public.workspace_invites as acceptance judges it. */
export type InviteRow = Pick<
    Row,
    "id" | "workspace_id" | "email" | "role" | "staff_id" | "accepted_at" | "revoked_at" | "expires_at"
>

/** The invitation fields a rotation or a revocation answers. */
export type ChangedInviteRow = Pick<Row, "id" | "email" | "role">

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
export type HeldRow = Pick<Row, "id">
