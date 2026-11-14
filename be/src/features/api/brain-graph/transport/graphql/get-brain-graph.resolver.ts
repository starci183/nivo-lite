import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetBrainGraphQuery } from "../../application/get-brain-graph.query"
import { BrainGraphInput } from "./dto/brain-graph.input"
import { BrainGraphType } from "./dto/brain-graph.type"
import { toBrainGraphType, toGetBrainGraphRequest } from "./brain-graph.mapper"

@Resolver()
/** GraphQL door of the truth graph read. */
export class GetBrainGraphResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** One page of the truth graph: nodes, edges, waiting change requests, source documents, totals. */
    @Query(() => BrainGraphType, { name: "brainGraph" })
    async brainGraph(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { type: () => BrainGraphInput, nullable: true }) input?: BrainGraphInput,
    ): Promise<BrainGraphType> {
        const result = await this.queryBus.execute(
            new GetBrainGraphQuery({ request: toGetBrainGraphRequest(workspaceId, input), principal }),
        )
        return toBrainGraphType(result)
    }
}
