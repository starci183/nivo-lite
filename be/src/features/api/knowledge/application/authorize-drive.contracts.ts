/** What authorizeDrive takes. */
export interface AuthorizeDriveRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The same-site path to come back to. */
    readonly returnTo: string
}

/** What authorizeDrive answers. */
export interface AuthorizeDriveResult {
    /** The Google consent address. */
    readonly url: string
}
