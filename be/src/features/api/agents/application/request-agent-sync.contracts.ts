/** What request agent sync takes. */
export interface RequestAgentSyncRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The one instance to sync; the whole workspace when absent. */
    readonly installationId?: string
    /** Also sync an instance that is not on OpenClaw yet. */
    readonly force?: boolean
}
