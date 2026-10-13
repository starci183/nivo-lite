import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetRequirementFactsQuery } from "../../application/get-requirement-facts.query"
import { ModuleRequirementFactsType } from "./dto/module-requirement-facts.type"
import { toGetRequirementFactsRequest, toModuleRequirementFactsType } from "./modules.mapper"

@Resolver()
/** GraphQL door of the facts behind the requirements of a module. */
export class ModuleRequirementFactsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What the workspace has for the requirements of a module: connected providers and head counts; the front end compares them with the requirements of the catalogue. */
    @Query(() => ModuleRequirementFactsType, { name: "moduleRequirementFacts" })
    async moduleRequirementFacts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ModuleRequirementFactsType> {
        const result = await this.queryBus.execute(
            new GetRequirementFactsQuery({ request: toGetRequirementFactsRequest(workspaceId), principal }),
        )
        return toModuleRequirementFactsType(result)
    }
}
