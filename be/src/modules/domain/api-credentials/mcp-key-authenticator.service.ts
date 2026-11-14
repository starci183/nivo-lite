import { Injectable } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import {
    IdentityError,
    IdentityErrorCode,
    type CredentialAuthenticator,
    type CredentialMetadata,
    type CredentialPrincipal,
} from "@modules/domain/identity"

@Injectable()
/**
 * The credential admission of the mcp app: its one door (`tool-token` of the `mcp-gateway` workflow) takes an MCP key, and the
 * principal is that KEY (its id) in the only workspace it acts for; the surface reads its holder and agent scope by that id. Every
 * other door is refused.
 */
export class McpKeyAuthenticatorService implements CredentialAuthenticator {
    constructor(private readonly keys: ApiKeysService) {}

    /** Verifies the MCP key of an endpoint request; a revoked key, a public API key or a key whose holder left is refused. */
    async authenticate(metadata: CredentialMetadata, authorization: string): Promise<CredentialPrincipal> {
        if (metadata.kind !== "tool-token" || metadata.workflow !== "mcp-gateway") {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        const principal = await this.keys.verifyMcpKey(authorization)
        return { kind: metadata.kind, subject: principal.keyId, workspaceId: principal.workspaceId }
    }
}
