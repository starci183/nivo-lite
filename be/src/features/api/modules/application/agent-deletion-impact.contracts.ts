/** What reading the impact of removing an installed agent takes. */
export interface AgentDeletionImpactRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation whose removal is asked about (the same id `removeAgent` takes). */
    readonly installationId: string
}
