import {
    IdentityError,
    IdentityErrorCode,
    type CredentialAuthenticator,
    type CredentialMetadata,
    type CredentialPrincipal,
    type CredentialResourceId,
} from "@modules/domain/identity"
import { HiringOffersService, HiringInterviewsService, HiringPostingService } from "@modules/domain/hiring"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { Injectable } from "@nestjs/common"
import { AgentToolsService } from "@modules/domain/agent-tools"
import { ApiKeysService } from "@modules/domain/api-keys"

@Injectable()
/** Composes credential admission with the existing owners; operations retain scope checks and call accounting. */
export class ApiCredentialAuthenticatorService implements CredentialAuthenticator {
    constructor(
        private readonly posting: HiringPostingService,
        private readonly offers: HiringOffersService,
        private readonly interviews: HiringInterviewsService,
        private readonly invites: WorkspaceInvitesService,
        private readonly keys: ApiKeysService,
        private readonly tools: AgentToolsService,
    ) {}

    /** Verifies a credential without consuming the operation's API-key or tool-call budget twice. */
    async authenticate(
        metadata: CredentialMetadata,
        authorization: string,
        resourceId?: CredentialResourceId,
    ): Promise<CredentialPrincipal> {
        switch (metadata.kind) {
            case "posting":
                if (metadata.workflow !== "apply-to-hiring-job" && metadata.workflow !== "create-hiring-cv-upload") {
                    throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
                }
                return this.posting.requireOpen({ ws: authorization, job: resourceId })
            case "link-token":
                switch (metadata.workflow) {
                    case "public-hiring-offer":
                    case "respond-hiring-offer":
                        return this.offers.authenticateLink(authorization)
                    case "public-hiring-interview":
                    case "respond-hiring-interview":
                        return this.interviews.authenticateLink(authorization)
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
            case "tool-token": {
                const principal = await this.tools.authenticate(authorization)
                return { kind: metadata.kind, subject: principal.jobId, workspaceId: principal.workspaceId }
            }
        }
    }
}
