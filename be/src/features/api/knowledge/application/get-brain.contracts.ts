/** What the GetBrain operation takes. */
export interface GetBrainRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
