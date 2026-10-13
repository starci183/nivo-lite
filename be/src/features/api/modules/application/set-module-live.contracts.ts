/** What switching an agent live takes. */
export interface SetModuleLiveRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** True to act on channels, false to stay silent. */
    readonly live: boolean
}
