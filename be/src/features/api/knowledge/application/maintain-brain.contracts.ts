/** What the MaintainBrain operation takes. */
export interface MaintainBrainRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
