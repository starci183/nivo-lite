/** What sendZaloTestMessage takes. */
export interface SendZaloTestRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The Zalo user id of the follower. */
    readonly recipientId: string
    /** The text to send. */
    readonly text: string
}
