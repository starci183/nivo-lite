/** What listing the people who may be named approvers takes. */
export interface ListApproversRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
