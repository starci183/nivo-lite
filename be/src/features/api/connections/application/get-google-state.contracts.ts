/** What googleConnectionState takes. */
export interface GetGoogleStateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What googleConnectionState answers. */
export interface GoogleStateResult {
    /** True when Google is set up. */
    readonly configured: boolean
}
