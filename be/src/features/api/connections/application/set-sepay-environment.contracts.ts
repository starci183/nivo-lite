/** What setSepayEnvironment takes. */
export interface SetSepayEnvironmentRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** Test or live. */
    readonly environment: "test" | "live"
}
