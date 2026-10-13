/** What renaming the agent of an installation takes. */
export interface RenameInstallationAgentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The new display name. */
    readonly name: string
}
