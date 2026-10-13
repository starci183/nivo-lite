import type { QueryBus } from "@nestjs/cqrs"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { NivoKnowledgeCountQuery } from "../../application/nivo-knowledge-count.query"
import { NivoKnowledgeCountInput } from "./dto/nivo-knowledge-count.input"
import { toNivoKnowledgeCountRequest } from "./nivo-knowledge-count.mapper"

@Resolver()
/** GraphQL door of the count of NIVO's base knowledge for one module. */
export class NivoKnowledgeCountResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** How many base-knowledge items the module runs on, counting the shared core; any signed-in person may read it. */
    @Query(() => Int, { name: "nivoKnowledgeCount" })
    async nivoKnowledgeCount(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: NivoKnowledgeCountInput,
    ): Promise<number> {
        return this.queryBus.execute(
            new NivoKnowledgeCountQuery({ request: toNivoKnowledgeCountRequest(input), principal }),
        )
    }
}
