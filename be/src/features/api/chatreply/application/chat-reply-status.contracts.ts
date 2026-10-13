/** The bounded application request for reads the delivery progress of a stored human reply. */
export interface ChatReplyStatusRequest {
    /** The workspace selector; the domain service proves membership. */
    readonly workspaceId: string
    /** The message id. */
    readonly messageId: string
}
