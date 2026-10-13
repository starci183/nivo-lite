/** What set member status takes. */
export interface SetMemberStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The member to enable or disable. */
    readonly userId: string
    /** `active` lets the member in, `disabled` locks them out of the workspace. */
    readonly status: "active" | "disabled"
}
