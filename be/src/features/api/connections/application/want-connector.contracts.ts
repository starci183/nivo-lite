/** What wantConnector takes. */
export interface WantConnectorRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The planned connector. */
    readonly connectorId: string
}
