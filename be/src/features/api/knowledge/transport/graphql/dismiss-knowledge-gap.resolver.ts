import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DismissKnowledgeGapCommand } from "../../application/dismiss-knowledge-gap.command"
import { DismissKnowledgeGapInput } from "./dto/dismiss-knowledge-gap.input"
import { toDismissKnowledgeGapRequest } from "./dismiss-knowledge-gap.mapper"

@Resolver()
/** GraphQL door of marks a customer question as not needing an answer. */
export class DismissKnowledgeGapResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a customer question as not needing an answer. */
    @Mutation(() => Boolean, { name: "dismissKnowledgeGap" })
    async dismissKnowledgeGap(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DismissKnowledgeGapInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new DismissKnowledgeGapCommand({ request: toDismissKnowledgeGapRequest(workspaceId, input), principal }))
        return true
    }
}
