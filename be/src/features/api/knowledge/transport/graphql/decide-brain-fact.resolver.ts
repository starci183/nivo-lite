import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideBrainFactCommand } from "../../application/decide-brain-fact.command"
import { DecideBrainFactInput } from "./dto/decide-brain-fact.input"
import { BrainFactType } from "./dto/brain-fact.type"
import { toDecideBrainFactRequest, toDecideBrainFactType } from "./decide-brain-fact.mapper"

@Resolver()
/** GraphQL door of applies, rejects, chooses, splits or retires a fact. */
export class DecideBrainFactResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies, rejects, chooses, splits or retires a fact. */
    @Mutation(() => BrainFactType, { name: "decideBrainFact" })
    async decideBrainFact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideBrainFactInput,
    ): Promise<BrainFactType> {
        const result = await this.commandBus.execute(new DecideBrainFactCommand({ request: toDecideBrainFactRequest(workspaceId, input), principal }))
        return toDecideBrainFactType(result)
    }
}
