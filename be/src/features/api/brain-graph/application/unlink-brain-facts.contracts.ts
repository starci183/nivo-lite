/** What the UnlinkBrainFacts operation takes. */
export interface UnlinkBrainFactsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The edge. */
    readonly id: string
}
