import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentTextsCommand } from "../../application/set-agent-texts.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { SetAgentTextsInput } from "./dto/set-agent-texts.input"
import { toAgentAckType, toSetAgentTextsRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that replaces the free texts of an agent. */
export class SetAgentTextsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Replaces the instructions and business notes of an agent; a manager only. */
    @Mutation(() => AgentAckType, { name: "setAgentTexts" })
    async setAgentTexts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentTextsInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new SetAgentTextsCommand({ request: toSetAgentTextsRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
