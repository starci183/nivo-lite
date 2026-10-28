/** What revealSepayKey takes. */
export interface RevealSepayKeyRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}

/** What revealSepayKey answers. */
export interface RevealSepayKeyResult {
    /** The SePay API key. */
    readonly apiKey: string
    /** The webhook address. */
    readonly webhookUrl: string
}
