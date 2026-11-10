import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UnlinkBrainFactsCommand } from "../../application/unlink-brain-facts.command"
import { UnlinkBrainFactsInput } from "./dto/unlink-brain-facts.input"
import { toUnlinkBrainFactsRequest } from "./brain-graph.mapper"

@Resolver()
/** GraphQL door of removing an edge of the truth graph. */
export class UnlinkBrainFactsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Removes an edge; answers whether it was there. */
    @Mutation(() => Boolean, { name: "unlinkBrainFacts" })
    async unlinkBrainFacts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UnlinkBrainFactsInput,
    ): Promise<boolean> {
        return this.commandBus.execute(
            new UnlinkBrainFactsCommand({ request: toUnlinkBrainFactsRequest(workspaceId, input), principal }),
        )
    }
}
