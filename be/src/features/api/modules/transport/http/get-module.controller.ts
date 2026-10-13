import { Controller, Get, Param } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { ModuleDefinition } from "@modules/domain/modules"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetModuleQuery } from "../../application/get-module.query"
import { GetModuleRequest } from "./dto/get-module.request"

@Controller("modules")
/** HTTP door of one module of the catalogue. */
export class GetModuleController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the definition of the module a signed-in caller names. */
    @Get(":key")
    getModule(@CurrentPrincipal() principal: Principal, @Param() input: GetModuleRequest): Promise<ModuleDefinition> {
        return this.queryBus.execute(new GetModuleQuery({ request: { key: input.key }, principal }))
    }
}
