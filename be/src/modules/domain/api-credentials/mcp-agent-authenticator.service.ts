import { Injectable } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import type { CredentialAuthenticator, CredentialMetadata, CredentialPrincipal } from "@modules/domain/identity"

@Injectable()
/**
 * The credential admission of the mcp app: its one door (`tool-token` of the `mcp-gateway` workflow) takes an agent key, and the
 * principal is the agent the key is bound to in the only workspace the key acts for. Every other door is refused.
 */
export class McpAgentAuthenticatorService implements CredentialAuthenticator {
    constructor(private readonly keys: ApiKeysService) {}

    /** Verifies the agent key of an MCP endpoint request; a revoked key or a deleted agent is refused. */
    async authenticate(metadata: CredentialMetadata, authorization: string): Promise<CredentialPrincipal> {
        if (metadata.kind !== "tool-token" || metadata.workflow !== "mcp-gateway") {
            throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
        const principal = await this.keys.verifyAgentKey(authorization)
        return { kind: metadata.kind, subject: principal.agentId, workspaceId: principal.workspaceId }
    }
}
