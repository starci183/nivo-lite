import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DisconnectConnectionCommand } from "../../application/disconnect-connection.command"
import { DisconnectConnectionInput } from "./dto/disconnect-connection.input"
import { toDisconnectConnectionRequest } from "./disconnect-connection.mapper"

@Resolver()
/** GraphQL door of disconnectConnection. */
export class DisconnectConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Disconnects a connection. */
    @Mutation(() => Boolean, { name: "disconnectConnection" })
    async disconnectConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DisconnectConnectionInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DisconnectConnectionCommand({ request: toDisconnectConnectionRequest(workspaceId, input), principal }),
        )
        return true
    }
}
