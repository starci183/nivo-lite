/** What authorizeGoogle takes. */
export interface AuthorizeGoogleRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The same-site path to come back to. */
    readonly returnTo: string
}

/** What authorizeGoogle answers. */
export interface AuthorizeGoogleResult {
    /** The Google consent address. */
    readonly url: string
}
