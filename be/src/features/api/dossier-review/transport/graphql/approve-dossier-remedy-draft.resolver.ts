import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApproveDossierRemedyDraftCommand } from "../../application/approve-dossier-remedy-draft.command"
import { DossierRemedyDraftRefInput } from "./dto/dossier-remedy-draft-ref.input"
import { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"
import {
    toApproveDossierRemedyDraftRequest,
    toApproveDossierRemedyDraftType,
} from "./approve-dossier-remedy-draft.mapper"

@Resolver()
/** GraphQL door of approveDossierRemedyDraft. */
export class ApproveDossierRemedyDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** approveDossierRemedyDraft: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierRemedyDraftType, { name: "approveDossierRemedyDraft" })
    async approveDossierRemedyDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DossierRemedyDraftRefInput,
    ): Promise<DossierRemedyDraftType> {
        const result = await this.commandBus.execute(
            new ApproveDossierRemedyDraftCommand({
                request: toApproveDossierRemedyDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return toApproveDossierRemedyDraftType(result)
    }
}
