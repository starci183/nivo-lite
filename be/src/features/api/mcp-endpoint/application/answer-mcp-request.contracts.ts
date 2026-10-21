/** What answering one message of the gateway endpoint takes. */
export interface AnswerMcpRequestRequest {
    /** The workspace the endpoint path names. */
    readonly workspaceId: string
    /** The agent the credential names. */
    readonly agentId: string
    /** The only workspace the credential acts for. */
    readonly credentialWorkspaceId: string
    /** The JSON-RPC message as the transport received it. */
    readonly message: unknown
}
