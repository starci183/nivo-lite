import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { ModulesCatalog } from "@modules/domain/modules"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCatalogQuery } from "../../application/get-catalog.query"

@Controller("modules")
/** HTTP door of the catalogue of installable agents. */
export class GetCatalogController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers every category and module of the catalogue to a signed-in caller. */
    @Get()
    getCatalog(@CurrentPrincipal() principal: Principal): Promise<ModulesCatalog> {
        return this.queryBus.execute(new GetCatalogQuery({ request: {}, principal }))
    }
}
