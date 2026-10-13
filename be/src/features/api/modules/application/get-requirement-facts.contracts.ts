/** What reading the facts behind the requirements of a module takes. */
export interface GetRequirementFactsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
