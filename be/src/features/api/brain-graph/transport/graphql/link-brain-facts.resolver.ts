import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LinkBrainFactsCommand } from "../../application/link-brain-facts.command"
import { BrainGraphEdgeType } from "./dto/brain-graph-edge.type"
import { LinkBrainFactsInput } from "./dto/link-brain-facts.input"
import { toBrainGraphEdgeType, toLinkBrainFactsRequest } from "./brain-graph.mapper"

@Resolver()
/** GraphQL door of drawing an edge between two truths. */
export class LinkBrainFactsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Draws an edge between two truths; the same edge again answers the stored one. */
    @Mutation(() => BrainGraphEdgeType, { name: "linkBrainFacts" })
    async linkBrainFacts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LinkBrainFactsInput,
    ): Promise<BrainGraphEdgeType> {
        const result = await this.commandBus.execute(
            new LinkBrainFactsCommand({ request: toLinkBrainFactsRequest(workspaceId, input), principal }),
        )
        return toBrainGraphEdgeType(result)
    }
}
