/** What the work of one agent: its switch, goals, tasks, triggers and last turns takes. */
export interface ReadAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance the tab is about. */
    readonly installationId: string
}
