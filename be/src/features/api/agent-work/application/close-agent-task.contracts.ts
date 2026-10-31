/** What close a task an agent is on takes. */
export interface CloseAgentTaskRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The task to close. */
    readonly taskId: string
}
