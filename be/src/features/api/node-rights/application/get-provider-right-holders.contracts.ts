/** What providerRightHolders takes. */
export interface GetProviderRightHoldersRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account whose rights tab is read. */
    readonly connectionId: string
}
