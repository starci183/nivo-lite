/** What setting or removing an agent picture takes. */
export interface SetAgentAvatarRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they govern its agents. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The uploaded object path; null or absent removes the picture. */
    readonly path?: string | null | undefined
}
