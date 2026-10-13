import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteConnectionCommand } from "../../application/delete-connection.command"
import { DisconnectConnectionCommand } from "../../application/disconnect-connection.command"
import { toDeleteConnectionRequest, toDisconnectConnectionRequest } from "./connection-lifecycle.mapper"

@Controller()
/** HTTP doors of disconnecting and removing connections (owner only). */
export class ConnectionLifecycleController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stops using a connection. */
    @Post("connections/:id/disconnect")
    @HttpCode(204)
    async disconnect(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<void> {
        await this.commandBus.execute(
            new DisconnectConnectionCommand({
                request: toDisconnectConnectionRequest(workspaceId, connectionId),
                principal,
            }),
        )
    }

    /** Removes a disconnected connection. */
    @Delete("connections/:id")
    @HttpCode(204)
    async remove(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<void> {
        await this.commandBus.execute(
            new DeleteConnectionCommand({ request: toDeleteConnectionRequest(workspaceId, connectionId), principal }),
        )
    }
}
