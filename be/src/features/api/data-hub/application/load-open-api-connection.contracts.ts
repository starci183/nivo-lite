/** What loadOpenApiConnection takes. */
export interface LoadOpenApiConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The API connection to reopen. */
    readonly connectionId: string
}
