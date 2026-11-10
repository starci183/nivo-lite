/** One invitation addressed to this account, already worded for the reader's language. */
export interface PendingInviteView {
    readonly id: string
    readonly workspaceName: string
    readonly inviterName: string
    /** The role the invitation offers, translated. */
    readonly roleLabel: string
    readonly expiresInDays: number
}

/** Why a member's access was turned off. A null fact hides its row. */
export interface WorkspaceReasonView {
    readonly workspaceName: string
    /** Who turned the access off, with their role when known. */
    readonly by: string | null
    /** When it was turned off, already formatted. */
    readonly at: string | null
    /** The note the person left. */
    readonly note: string | null
    /** Who can be messaged about it; null when nobody can. */
    readonly contactName: string | null
}
