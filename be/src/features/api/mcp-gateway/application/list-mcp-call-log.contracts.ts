/** What listMcpCallLog takes. */
export interface ListMcpCallLogRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** How many lines. */
    readonly limit?: number | null
}
