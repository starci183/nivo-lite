/** What listProviderTemplateCandidates takes. */
export interface ListProviderTemplateCandidatesRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider. */
    readonly provider: string
}
