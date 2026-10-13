import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetConnectionAgentsCommand } from "../../application/set-connection-agents.command"
import { SetConnectionAgentsInput } from "./dto/set-connection-agents.input"
import { toSetConnectionAgentsRequest } from "./set-connection-agents.mapper"

@Resolver()
/** GraphQL door of setConnectionAgents. */
export class SetConnectionAgentsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Makes exactly these agents use a connection. */
    @Mutation(() => Boolean, { name: "setConnectionAgents" })
    async setConnectionAgents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetConnectionAgentsInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetConnectionAgentsCommand({ request: toSetConnectionAgentsRequest(workspaceId, input), principal }),
        )
        return true
    }
}
