import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetAgentConnectionsCommand } from "../../application/set-agent-connections.command"
import { SetConnectionAgentsCommand } from "../../application/set-connection-agents.command"
import { SetGrantCommand } from "../../application/set-grant.command"
import { toAgentWishes, toConnectionWishes } from "./connection-grants.mapper"
import {
    SetAgentConnectionsRequest,
    SetConnectionAgentsRequest,
    SetGrantRequest,
} from "./dto/connection-grants.request"

@Controller()
/** HTTP doors of the agent access to connections (owner only). */
export class ConnectionGrantsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Gives, changes or removes one agent access to one connection. */
    @Put("connections/:id/grants/:agentId")
    @HttpCode(204)
    async setGrant(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Param("agentId", new ParseUUIDPipe()) agentId: string,
        @Body() body: SetGrantRequest,
    ): Promise<void> {
        await this.commandBus.execute(
            new SetGrantCommand({
                request: { workspaceId, connectionId, agentId, access: body.access },
                principal,
            }),
        )
    }

    /** Makes exactly these agents the users of a connection. */
    @Put("connections/:id/agents")
    @HttpCode(204)
    async setConnectionAgents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: SetConnectionAgentsRequest,
    ): Promise<void> {
        await this.commandBus.execute(
            new SetConnectionAgentsCommand({
                request: { workspaceId, connectionId, agents: toAgentWishes(body.agents) },
                principal,
            }),
        )
    }

    /** Makes exactly these connections the ones an agent uses. */
    @Put("agents/:agentId/connections")
    @HttpCode(204)
    async setAgentConnections(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("agentId", new ParseUUIDPipe()) agentId: string,
        @Body() body: SetAgentConnectionsRequest,
    ): Promise<void> {
        await this.commandBus.execute(
            new SetAgentConnectionsCommand({
                request: { workspaceId, agentId, connections: toConnectionWishes(body.connections) },
                principal,
            }),
        )
    }
}
