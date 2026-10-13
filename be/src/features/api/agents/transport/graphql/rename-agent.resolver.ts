import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RenameAgentCommand } from "../../application/rename-agent.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { RenameAgentInput } from "./dto/rename-agent.input"
import { toAgentAckType, toRenameAgentRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that renames an agent. */
export class RenameAgentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames an agent; a manager only. */
    @Mutation(() => AgentAckType, { name: "renameAgent" })
    async renameAgent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RenameAgentInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new RenameAgentCommand({ request: toRenameAgentRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
