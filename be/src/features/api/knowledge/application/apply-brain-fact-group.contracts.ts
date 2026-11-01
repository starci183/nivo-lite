/** What the ApplyBrainFactGroup operation takes. */
export interface ApplyBrainFactGroupRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document whose checked facts are applied together. */
    readonly sourceId: string
}
