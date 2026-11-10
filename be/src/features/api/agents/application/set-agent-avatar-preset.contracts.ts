/** What dressing an agent in a preset picture takes. */
export interface SetAgentAvatarPresetRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they govern its agents. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The preset (nivo-ai, role, initials, a shop mark); null goes back to the default sprout. */
    readonly preset: string | null
}
