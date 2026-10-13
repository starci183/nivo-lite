/** What maintain brain takes. */
export interface MaintainBrainRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
}
