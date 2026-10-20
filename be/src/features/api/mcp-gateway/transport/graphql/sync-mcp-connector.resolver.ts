import type { CommandBus } from "@nestjs/cqrs"
import { Args, Int, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SyncMcpConnectorInput } from "./dto/sync-mcp-connector.input"
import { SyncMcpConnectorCommand } from "../../application/sync-mcp-connector.command"

@Resolver()
/** GraphQL door of syncMcpConnector. */
export class SyncMcpConnectorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reads a remote connector's tools/list into its catalog; answers the tool count. */
    @Mutation(() => Int, { name: "syncMcpConnector" })
    async syncMcpConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SyncMcpConnectorInput,
    ): Promise<number> {
        const result = await this.commandBus.execute(
            new SyncMcpConnectorCommand({ request: { workspaceId, key: input.key }, principal }),
        )
        return result
    }
}
