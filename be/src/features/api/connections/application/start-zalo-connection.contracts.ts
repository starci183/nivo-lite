/** What startZaloConnection takes. */
export interface StartZaloConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name. */
    readonly name: string
    /** The Zalo app id. */
    readonly appId: string
    /** The Zalo app secret. */
    readonly appSecret: string
}
