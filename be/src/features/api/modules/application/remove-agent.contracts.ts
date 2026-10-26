/** What removing an installed agent takes. */
export interface RemoveAgentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation to remove. */
    readonly installationId: string
}
