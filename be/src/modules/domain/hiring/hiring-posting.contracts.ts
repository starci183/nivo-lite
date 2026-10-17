/** Raw public posting identifiers checked before request validation. */
export interface PostingCredentialRequest {
    /** The public workspace slug supplied by the caller. */
    readonly ws?: unknown
    /** The published job slug supplied by the caller. */
    readonly job?: unknown
}
