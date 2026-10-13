/** What loadDatabaseConnection takes. */
export interface LoadDatabaseConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The saved database connection. */
    readonly connectionId: string
}
