/** What providerTriggerStates takes. */
export interface GetProviderTriggerStatesRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account whose triggers are read. */
    readonly connectionId: string
}
