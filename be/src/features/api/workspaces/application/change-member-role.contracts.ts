/** What change member role takes. */
export interface ChangeMemberRoleRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The member whose role changes. */
    readonly userId: string
    /** The role to give. */
    readonly role: "owner" | "manager" | "staff"
}
