/** What listing command cards takes. */
export interface ListCommandCandidatesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
