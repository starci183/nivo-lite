import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideRunStopCommand } from "../../application/decide-run-stop.command"
import { toAgentRunStopDecisionType, toDecideRunStopRequest } from "./decide-run-stop.mapper"
import { AgentRunStopDecisionType } from "./dto/agent-run-stop-decision.type"
import { DecideRunStopInput } from "./dto/decide-run-stop.input"

@Resolver()
/** GraphQL door of decideRunStop. */
export class DecideRunStopResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /**
     * Answers the stop of a run on a LangGraph thread: the founder's words (the step runs again with them), Retry, Take over or Skip.
     * Owner or manager only; a stop already resolved answers stop_closed and moves nothing.
     */
    @Mutation(() => AgentRunStopDecisionType, { name: "decideRunStop" })
    async decideRunStop(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideRunStopInput,
    ): Promise<AgentRunStopDecisionType> {
        const result = await this.commandBus.execute(
            new DecideRunStopCommand({ request: toDecideRunStopRequest(workspaceId, input), principal }),
        )
        return toAgentRunStopDecisionType(result)
    }
}
