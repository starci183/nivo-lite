import { ParseUUIDPipe } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Args, ID, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetCatalogQuery } from "../../application/get-catalog.query"
import { ModulesCatalogType } from "./dto/modules-catalog.type"
import { toModulesCatalogType } from "./module-lists.mapper"
import { toCatalogRequest } from "./modules.mapper"

@Resolver()
/** GraphQL door of the catalogue of installable agents. */
export class ModulesCatalogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /**
     * Answers the catalogue to a signed-in caller: every category and the modules of every installed plugin that are open to the
     * workspace named (the caller must be a member), each with its plugin. With no workspace, the modules of public plugins only.
     */
    @Query(() => ModulesCatalogType, { name: "modulesCatalog" })
    async modulesCatalog(
        @CurrentPrincipal() principal: Principal,
        @Args("workspaceId", { type: () => ID, nullable: true, defaultValue: null }, new ParseUUIDPipe({ optional: true }))
        workspaceId: string | null,
    ): Promise<ModulesCatalogType> {
        const result = await this.queryBus.execute(new GetCatalogQuery({ request: toCatalogRequest(workspaceId), principal }))
        return toModulesCatalogType(result)
    }
}
