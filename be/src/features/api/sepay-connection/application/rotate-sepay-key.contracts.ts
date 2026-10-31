/** What rotateSepayKey takes. */
export interface RotateSepayKeyRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}

/** What rotateSepayKey answers. */
export interface RotateSepayKeyResult {
    /** The SePay API key. */
    readonly apiKey: string
    /** The webhook address. */
    readonly webhookUrl: string
}
