/** What dataSyncRun takes. */
export interface DataSyncRunRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The run to read. */
    readonly runId: string
}
