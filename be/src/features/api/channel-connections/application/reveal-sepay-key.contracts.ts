/** What the RevealSepayKey operation takes. */
export interface RevealSepayKeyRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the RevealSepayKey operation answers. */
export type RevealSepayKeyResult = { readonly apiKey: string; readonly webhookUrl: string }
