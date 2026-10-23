/** What create invite takes. */
export interface CreateInviteRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The address to invite. */
    readonly email: string
    /** The role the invitation grants. */
    readonly role: "manager" | "staff"
    /** The staff row the account will be, when any. */
    readonly staffId?: string | undefined
}
