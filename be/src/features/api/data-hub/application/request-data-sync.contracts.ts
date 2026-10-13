/** What requestDataSync takes. */
export interface RequestDataSyncRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The data connection to sync now. */
    readonly connectionId: string
}
