/** What attachProviderByTemplate takes. */
export interface AttachProviderByTemplateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account (the connection). */
    readonly connectionId: string
    /** The agents to attach. */
    readonly agentIds: ReadonlyArray<string>
}
