import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetBrainQuery } from "../../application/get-brain.query"
import { BrainType } from "./dto/brain.type"
import { BrainFactsPageInput } from "./dto/brain-facts-page.input"
import { toGetBrainRequest, toGetBrainType } from "./get-brain.mapper"

@Resolver()
/** GraphQL door of reads everything the Second Brain page shows. */
export class GetBrainResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /**
     * Reads everything the Second Brain page shows; `facts` pages the facts (keyset, `factsNextCursor`, `factsTotal`). Without it the
     * first page of 2,000 facts in force, waiting or scheduled, as before.
     */
    @Query(() => BrainType, { name: "brain" })
    async brain(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("facts", { type: () => BrainFactsPageInput, nullable: true }) facts?: BrainFactsPageInput | null,
    ): Promise<BrainType> {
        const result = await this.queryBus.execute(
            new GetBrainQuery({ request: toGetBrainRequest(workspaceId, facts), principal }),
        )
        return toGetBrainType(result)
    }
}
