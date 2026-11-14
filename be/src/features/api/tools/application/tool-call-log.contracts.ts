/** What listToolCallLog takes. */
export interface ToolCallLogRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** How many lines. */
    readonly limit?: number | null | undefined
}
