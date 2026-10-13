import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckConnectionCommand } from "../../application/check-connection.command"
import { CheckConnectionInput } from "./dto/check-connection.input"
import { ConnectionCheckType } from "./dto/connection-check.type"
import { toCheckConnectionRequest, toCheckConnectionType } from "./check-connection.mapper"

@Resolver()
/** GraphQL door of checkConnection. */
export class CheckConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks the provider what it knows about a connection. */
    @Mutation(() => ConnectionCheckType, { name: "checkConnection" })
    async checkConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CheckConnectionInput,
    ): Promise<ConnectionCheckType> {
        const result = await this.commandBus.execute(
            new CheckConnectionCommand({ request: toCheckConnectionRequest(workspaceId, input), principal }),
        )
        return toCheckConnectionType(result)
    }
}
