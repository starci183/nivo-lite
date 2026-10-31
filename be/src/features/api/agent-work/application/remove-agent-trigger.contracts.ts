/** What remove a trigger of an agent takes. */
export interface RemoveAgentTriggerRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The trigger to remove. */
    readonly triggerId: string
}
