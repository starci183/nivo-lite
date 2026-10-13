import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetModuleQuery } from "../../application/get-module.query"
import { ModuleDefinitionType } from "./dto/module-definition.type"
import { ModuleKeyInput } from "./dto/module-key.input"
import { toGetModuleRequest, toModuleDefinitionType } from "./modules.mapper"

@Resolver()
/** GraphQL door of one module of the catalogue. */
export class ModuleDefinitionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the definition of the module a signed-in caller names. */
    @Query(() => ModuleDefinitionType, { name: "moduleDefinition" })
    async moduleDefinition(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: ModuleKeyInput,
    ): Promise<ModuleDefinitionType> {
        const result = await this.queryBus.execute(
            new GetModuleQuery({ request: toGetModuleRequest(input), principal }),
        )
        return toModuleDefinitionType(result)
    }
}
