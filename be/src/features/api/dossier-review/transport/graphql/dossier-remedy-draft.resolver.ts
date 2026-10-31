import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DossierRemedyDraftQuery } from "../../application/dossier-remedy-draft.query"
import { DossierRemedyDraftRefInput } from "./dto/dossier-remedy-draft-ref.input"
import { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"
import { toDossierRemedyDraftRequest, toDossierRemedyDraftType } from "./dossier-remedy-draft.mapper"

@Resolver()
/** GraphQL door of dossierRemedyDraft. */
export class DossierRemedyDraftResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** dossierRemedyDraft: any member reads, every change needs an owner or manager. */
    @Query(() => DossierRemedyDraftType, { name: "dossierRemedyDraft", nullable: true })
    async dossierRemedyDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DossierRemedyDraftRefInput,
    ): Promise<DossierRemedyDraftType | null> {
        const result = await this.queryBus.execute(
            new DossierRemedyDraftQuery({ request: toDossierRemedyDraftRequest(workspaceId, input), principal }),
        )
        return toDossierRemedyDraftType(result)
    }
}
