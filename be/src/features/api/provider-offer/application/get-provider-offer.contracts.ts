/** What providerOffer takes. */
export interface GetProviderOfferRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account whose provider is documented. */
    readonly connectionId: string
}
