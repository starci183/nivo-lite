import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BrainDossiersQuery } from "../../application/brain-dossiers.query"
import { BrainDossierType } from "./dto/brain-dossier.type"
import { toBrainDossierTypes, toBrainDossiersRequest } from "./brain-dossiers.mapper"

@Resolver()
/** GraphQL door of the dossiers the workspace tracks. */
export class BrainDossiersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The dossiers by category and position, each with the documents that name it; any member may read them. */
    @Query(() => [BrainDossierType], { name: "brainDossiers" })
    async brainDossiers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<BrainDossierType>> {
        const result = await this.queryBus.execute(
            new BrainDossiersQuery({ request: toBrainDossiersRequest(workspaceId), principal }),
        )
        return toBrainDossierTypes(result)
    }
}
