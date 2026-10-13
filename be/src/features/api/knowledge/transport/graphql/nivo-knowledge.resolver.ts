import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { NivoKnowledgeQuery } from "../../application/nivo-knowledge.query"
import { NivoEntryType } from "./dto/nivo-entry.type"
import { toNivoKnowledgeType } from "./nivo-knowledge.mapper"

@Resolver()
/** GraphQL door of lists the base knowledge of NIVO, which every signed-in person may read. */
export class NivoKnowledgeResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the base knowledge of NIVO, which every signed-in person may read. */
    @Query(() => [NivoEntryType], { name: "nivoKnowledge" })
    async nivoKnowledge(
        @CurrentPrincipal() principal: Principal,
    ): Promise<Array<NivoEntryType>> {
        const result = await this.queryBus.execute(new NivoKnowledgeQuery({ request: {}, principal }))
        return toNivoKnowledgeType(result)
    }
}
