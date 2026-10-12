/** What an invitation link offers before it is accepted. */
export class InvitePreviewResponse {
    /** The workspace they are invited to. */
    workspaceName!: string
    /** The invited address. */
    email!: string
    /** The role it grants. */
    role!: string
    /** The staff member it links, when any. */
    staffName!: string | null
    /** `pending`, `revoked`, `accepted` or `expired`. */
    state!: string
}
