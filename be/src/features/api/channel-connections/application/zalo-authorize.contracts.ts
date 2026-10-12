/** What the ZaloAuthorize operation takes. */
export interface ZaloAuthorizeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the ZaloAuthorize operation answers. */
export type ZaloAuthorizeResult = { readonly url: string }
