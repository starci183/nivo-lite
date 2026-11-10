/** What attachProviderByTemplate takes. */
export interface AttachProviderByTemplateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider. */
    readonly provider: string
    /** The agents to attach. */
    readonly agentIds: ReadonlyArray<string>
}
