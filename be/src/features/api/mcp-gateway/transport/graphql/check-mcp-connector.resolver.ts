import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckMcpConnectorCommand } from "../../application/check-mcp-connector.command"
import { CheckMcpConnectorInput } from "./dto/check-mcp-connector.input"

@Resolver()
/** GraphQL door of checkMcpConnector. */
export class CheckMcpConnectorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Checks that a remote connector answers MCP; answers the status it recorded (active or degraded). */
    @Mutation(() => String, { name: "checkMcpConnector" })
    async checkMcpConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CheckMcpConnectorInput,
    ): Promise<string> {
        const result = await this.commandBus.execute(
            new CheckMcpConnectorCommand({ request: { workspaceId, key: input.key }, principal }),
        )
        return result
    }
}
