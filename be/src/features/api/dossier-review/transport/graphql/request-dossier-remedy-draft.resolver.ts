import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestDossierRemedyDraftCommand } from "../../application/request-dossier-remedy-draft.command"
import { RequestDossierRemedyDraftInput } from "./dto/request-dossier-remedy-draft.input"
import { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"
import {
    toRequestDossierRemedyDraftRequest,
    toRequestDossierRemedyDraftType,
} from "./request-dossier-remedy-draft.mapper"

@Resolver()
/** GraphQL door of requestDossierRemedyDraft. */
export class RequestDossierRemedyDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** requestDossierRemedyDraft: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierRemedyDraftType, { name: "requestDossierRemedyDraft" })
    async requestDossierRemedyDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestDossierRemedyDraftInput,
    ): Promise<DossierRemedyDraftType> {
        const result = await this.commandBus.execute(
            new RequestDossierRemedyDraftCommand({
                request: toRequestDossierRemedyDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return toRequestDossierRemedyDraftType(result)
    }
}
