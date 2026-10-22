/** What the ListWorkThreads operation takes. */
export interface ListWorkThreadsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only threads about this lead; null lists every thread. */
    readonly leadId: string | null
}
