/** A pending invitation as the team page lists it. */
export class PendingInviteResponse {
    /** The invitation id. */
    id!: string
    /** The invited address. */
    email!: string
    /** The role it grants. */
    role!: string
    /** The staff row it links, when any. */
    staffId!: string | null
    /** When it was issued, ISO 8601. */
    createdAt!: string
    /** When the link stops working, ISO 8601. */
    expiresAt!: string
}
