/** What begin Zalo authorization takes. */
export interface BeginZaloAuthorizationRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The Zalo OA connection to authorize. */
    readonly connectionId: string
}
