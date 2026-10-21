import type { CommandBus } from "@nestjs/cqrs"
import { Args, Int, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApproveMcpConnectorCommand } from "../../application/approve-mcp-connector.command"
import { ApproveMcpConnectorInput } from "./dto/approve-mcp-connector.input"

@Resolver()
/** GraphQL door of approveMcpConnector. */
export class ApproveMcpConnectorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves the live tool catalog of a remote connector as it was read; answers how many tools may now run. */
    @Mutation(() => Int, { name: "approveMcpConnector" })
    async approveMcpConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApproveMcpConnectorInput,
    ): Promise<number> {
        const result = await this.commandBus.execute(
            new ApproveMcpConnectorCommand({ request: { workspaceId, key: input.key }, principal }),
        )
        return result
    }
}
