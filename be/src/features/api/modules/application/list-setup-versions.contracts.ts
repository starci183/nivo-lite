/** What listing the context versions of an agent takes. */
export interface ListSetupVersionsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
}
