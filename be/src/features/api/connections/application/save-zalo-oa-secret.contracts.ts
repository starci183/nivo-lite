/** What saveZaloOaSecret takes. */
export interface SaveZaloOaSecretRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The OA Secret Key. */
    readonly oaSecret: string
}
