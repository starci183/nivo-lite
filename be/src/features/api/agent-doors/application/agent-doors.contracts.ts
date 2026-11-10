/** What careOptOut takes: one customer of the workspace. */
export interface ReadCareOptOutRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer (lead). */
    readonly leadId: string
}

/** What setCareOptOut takes: the customer and whether nobody writes to them unprompted. */
export interface SetCareOptOutRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer (lead). */
    readonly leadId: string
    /** True to opt out, false to clear it. */
    readonly optOut: boolean
}

/** What releaseConversation takes: the conversation and which hold to clear. */
export interface ReleaseConversationRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** `person`, `agent` or `both` (absent: both). */
    readonly hold?: string | null | undefined
}
