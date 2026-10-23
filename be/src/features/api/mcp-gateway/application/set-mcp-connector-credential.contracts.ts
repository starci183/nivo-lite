import type { McpCredentialInput } from "@modules/domain/mcp-gateway"
/** What setMcpConnectorCredential takes. */
export interface SetMcpConnectorCredentialRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connector key and the credential, already wrapped so it is never serialized. */
    readonly credential: McpCredentialInput
}
