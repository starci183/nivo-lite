/** What the GoogleAuthorize operation takes. */
export interface GoogleAuthorizeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The returnTo sent by the caller. */
    readonly returnTo: string
}

/** What the GoogleAuthorize operation answers. */
export type GoogleAuthorizeResult = { readonly url: string }
