/** What reading the OpenClaw sync status of an agent takes. */
export interface GetAgentSyncStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
}
