import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentAbilityCommand } from "../../application/set-agent-ability.command"
import { SetAgentAbilityInput } from "./dto/set-agent-ability.input"
import { toMcpDone } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of setAgentAbility. */
export class SetAgentAbilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ticks one ability of an attachment (auto or ask) or unticks it (off). */
    @Mutation(() => Boolean, { name: "setAgentAbility" })
    async setAgentAbility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentAbilityInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetAgentAbilityCommand({
                request: {
                    workspaceId,
                    ability: {
                        agentId: input.agentId,
                        connectionId: input.connectionId,
                        ability: input.ability,
                        mode: input.mode,
                    },
                },
                principal,
            }),
        )
        return toMcpDone()
    }
}
