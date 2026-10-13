/** What the whole hiring workbench of the caller's workspace takes. */
export interface HiringWorkbenchRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
