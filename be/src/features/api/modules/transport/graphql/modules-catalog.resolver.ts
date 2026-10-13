import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCatalogQuery } from "../../application/get-catalog.query"
import { ModulesCatalogType } from "./dto/modules-catalog.type"
import { toCatalogRequest, toModulesCatalogType } from "./modules.mapper"

@Resolver()
/** GraphQL door of the catalogue of installable agents. */
export class ModulesCatalogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers every category and module of the catalogue to a signed-in caller. */
    @Query(() => ModulesCatalogType, { name: "modulesCatalog" })
    async modulesCatalog(@CurrentPrincipal() principal: Principal): Promise<ModulesCatalogType> {
        const result = await this.queryBus.execute(new GetCatalogQuery({ request: toCatalogRequest(), principal }))
        return toModulesCatalogType(result)
    }
}
