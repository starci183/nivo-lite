/** What the GoogleState operation takes. */
export interface GoogleStateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What the GoogleState operation answers. */
export type GoogleStateResult = { readonly configured: boolean }
