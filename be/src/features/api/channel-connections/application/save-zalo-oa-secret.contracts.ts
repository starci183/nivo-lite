/** What the SaveZaloOaSecret operation takes. */
export interface SaveZaloOaSecretRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
    /** The oaSecret sent by the caller. */
    readonly oaSecret: string
}

/** What the SaveZaloOaSecret operation answers. */
export type SaveZaloOaSecretResult = void
