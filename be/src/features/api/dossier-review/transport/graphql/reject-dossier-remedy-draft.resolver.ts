import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RejectDossierRemedyDraftCommand } from "../../application/reject-dossier-remedy-draft.command"
import { RejectDossierRemedyDraftInput } from "./dto/reject-dossier-remedy-draft.input"
import { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"
import { toRejectDossierRemedyDraftRequest, toRejectDossierRemedyDraftType } from "./reject-dossier-remedy-draft.mapper"

@Resolver()
/** GraphQL door of rejectDossierRemedyDraft. */
export class RejectDossierRemedyDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** rejectDossierRemedyDraft: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierRemedyDraftType, { name: "rejectDossierRemedyDraft" })
    async rejectDossierRemedyDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RejectDossierRemedyDraftInput,
    ): Promise<DossierRemedyDraftType> {
        const result = await this.commandBus.execute(
            new RejectDossierRemedyDraftCommand({
                request: toRejectDossierRemedyDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return toRejectDossierRemedyDraftType(result)
    }
}
