/** What switch work on or off for one agent takes. */
export interface SetAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** True to switch work on. */
    readonly enabled: boolean
}
