import {
    IdentityError,
    IdentityErrorCode,
    type CredentialAuthenticator,
    type CredentialMetadata,
    type CredentialPrincipal,
} from "@modules/domain/identity"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { Injectable } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"

@Injectable()
/** Composes credential admission with the existing owners; operations retain scope checks and call accounting. */
export class ApiCredentialAuthenticatorService implements CredentialAuthenticator {
    constructor(
        private readonly invites: WorkspaceInvitesService,
        private readonly keys: ApiKeysService,
    ) {}

    /** Verifies a credential without consuming the operation's API-key or tool-call budget twice. */
    async authenticate(metadata: CredentialMetadata, authorization: string): Promise<CredentialPrincipal> {
        switch (metadata.kind) {
            case "link-token":
                switch (metadata.workflow) {
                    case "preview-invite":
                        return this.invites.authenticateLink(authorization)
                    case undefined:
                    default:
                        throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
                }
            case "api-key": {
                const principal = await this.keys.verifyCredential(authorization)
                return { kind: metadata.kind, subject: principal.keyId, workspaceId: principal.workspaceId }
            }
            // No door of this app takes an agent's token: an agent reaches the app through the MCP gateway alone (its own app).
            case "tool-token":
                throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        }
    }
}
