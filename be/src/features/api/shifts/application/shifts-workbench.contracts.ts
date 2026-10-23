/** What the whole shifts workbench of the caller's workspace for one week takes. */
export interface ShiftsWorkbenchRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Any day of the week, YYYY-MM-DD; absent means the current one. */
    readonly week?: string | undefined
}
