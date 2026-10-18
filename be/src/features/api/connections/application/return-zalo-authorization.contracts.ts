/** What returnZaloAuthorization takes. */
export interface ReturnZaloAuthorizationRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The state the authorization started with. */
    readonly state: string
    /** The authorization code. */
    readonly code: string
    /** The OA id Zalo reports. */
    readonly oaId?: string
}
