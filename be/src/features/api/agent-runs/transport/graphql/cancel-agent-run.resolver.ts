import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { CancelAgentRunCommand } from "../../application/cancel-agent-run.command"
import { toAgentRunCancelType, toCancelAgentRunRequest } from "./cancel-agent-run.mapper"
import { AgentRunCancelType } from "./dto/agent-run-cancel.type"
import { CancelAgentRunInput } from "./dto/cancel-agent-run.input"

@Resolver()
/** GraphQL door of cancelAgentRun. */
export class CancelAgentRunResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stops a queued, running or waiting run of the workspace: no further step runs and its waits are released; what it already sent is not undone. Owner or manager only. */
    @Mutation(() => AgentRunCancelType, { name: "cancelAgentRun" })
    async cancelAgentRun(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CancelAgentRunInput,
    ): Promise<AgentRunCancelType> {
        const result = await this.commandBus.execute(
            new CancelAgentRunCommand({ request: toCancelAgentRunRequest(workspaceId, input), principal }),
        )
        return toAgentRunCancelType(result)
    }
}
