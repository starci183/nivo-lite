/** What listing the approval limits of one action takes. */
export interface ListMemberGrantsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The action key. */
    readonly action: string
}
