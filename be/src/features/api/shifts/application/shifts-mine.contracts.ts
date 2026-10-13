/** What the signed-in person's own shifts view takes. */
export interface ShiftsMineRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
