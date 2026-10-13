/** What cancelling a command card takes. */
export interface CancelCommandRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The command card. */
    readonly candidateId: string
}
