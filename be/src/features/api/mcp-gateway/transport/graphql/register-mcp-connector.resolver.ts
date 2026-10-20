import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RegisterMcpConnectorCommand } from "../../application/register-mcp-connector.command"
import { RegisterMcpConnectorInput } from "./dto/register-mcp-connector.input"
import { toRemoteConnectorInput, toMcpDone } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of registerMcpConnector. */
export class RegisterMcpConnectorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Registers a remote MCP server behind the gateway. */
    @Mutation(() => Boolean, { name: "registerMcpConnector" })
    async registerMcpConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RegisterMcpConnectorInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RegisterMcpConnectorCommand({
                request: { workspaceId, connector: toRemoteConnectorInput(input) },
                principal,
            }),
        )
        return toMcpDone()
    }
}
