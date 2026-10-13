/** Where an invitation stands. */
export type InviteState = "pending" | "expired" | "revoked" | "accepted"

/** What the holder of an invitation link may see before signing in. */
export interface InvitePreview {
    readonly workspaceName: string
    readonly email: string
    readonly role: "manager" | "staff"
    readonly staffName: string | null
    readonly state: InviteState
}

/** One row of the `invite_preview` function. */
export interface InvitePreviewRow {
    readonly workspace_name: string
    readonly email: string
    readonly role: string
    readonly staff_name: string | null
    readonly state: string
}

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u
const STATES: ReadonlyArray<InviteState> = ["pending", "expired", "revoked", "accepted"]
/** The database error messages `accept_invite` raises. */
const FAILURES = ["invite_invalid", "invite_revoked", "invite_used", "invite_expired", "invite_email_mismatch"] as const

type TokenParse = { readonly success: true; readonly data: string } | { readonly success: false }

/** Bounds the token an invitation request carries. */
export const inviteTokenSchema = {
    safeParse: (input: string): TokenParse => (TOKEN.test(input) ? { success: true, data: input } : { success: false }),
}

/** Maps the first `invite_preview` row; null when the token matched nothing or the row is not understood. */
export const previewFromRows = (rows: ReadonlyArray<InvitePreviewRow>): InvitePreview | null => {
    const row = rows[0]
    const state = STATES.find((candidate) => candidate === row?.state)
    if (row === undefined || state === undefined) return null
    return {
        workspaceName: row.workspace_name,
        email: row.email,
        role: row.role === "manager" ? "manager" : "staff",
        staffName: row.staff_name,
        state,
    }
}

/** The stable failure code inside a database error message, or "invite_failed". */
export const inviteFailureCode = (message: string): string =>
    FAILURES.find((code) => message.includes(code)) ?? "invite_failed"
