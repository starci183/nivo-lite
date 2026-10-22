/** What set agent ownership takes. */
export interface SetAgentOwnershipRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The member in charge. */
    readonly ownerMemberId: string
    /** The member who takes over when the owner left or is disabled. */
    readonly fallbackMemberId: string
    /** The workspace roles that may hand the agent work. */
    readonly assignableRoles: ReadonlyArray<string>
    /** The department room keys whose members may hand the agent work. */
    readonly assignableRooms: ReadonlyArray<string>
    /** The other agents it may pass work to. */
    readonly canTagAgentIds: ReadonlyArray<string>
}
