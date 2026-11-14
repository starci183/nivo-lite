/** What listProviderTemplateCandidates takes. */
export interface ListProviderTemplateCandidatesRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account (the connection). */
    readonly connectionId: string
}
