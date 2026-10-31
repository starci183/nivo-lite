import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveDossierRemedyDraftCommand } from "../../application/save-dossier-remedy-draft.command"
import { SaveDossierRemedyDraftInput } from "./dto/save-dossier-remedy-draft.input"
import { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"
import { toSaveDossierRemedyDraftRequest, toSaveDossierRemedyDraftType } from "./save-dossier-remedy-draft.mapper"

@Resolver()
/** GraphQL door of saveDossierRemedyDraft. */
export class SaveDossierRemedyDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** saveDossierRemedyDraft: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierRemedyDraftType, { name: "saveDossierRemedyDraft" })
    async saveDossierRemedyDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveDossierRemedyDraftInput,
    ): Promise<DossierRemedyDraftType> {
        const result = await this.commandBus.execute(
            new SaveDossierRemedyDraftCommand({
                request: toSaveDossierRemedyDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveDossierRemedyDraftType(result)
    }
}
