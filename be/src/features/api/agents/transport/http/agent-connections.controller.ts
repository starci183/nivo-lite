import { Body, Controller, Delete, Get, HttpCode, Param, Put } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GrantAgentConnectionCommand } from "../../application/grant-agent-connection.command"
import { ListAgentConnectionsQuery } from "../../application/list-agent-connections.query"
import { RevokeAgentConnectionCommand } from "../../application/revoke-agent-connection.command"
import { toAgentConnectionsResponse } from "./agents.mapper"
import { AgentConnectionIdRequest } from "./dto/agent-connection-id.request"
import { AgentConnectionResponse } from "./dto/agent-connection.response"
import { AgentIdRequest } from "./dto/agent-id.request"
import { GrantAgentConnectionRequest } from "./dto/grant-agent-connection.request"

@Controller("agents/:agentId/connections")
/** HTTP doors of the connections granted to one agent. */
export class AgentConnectionsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the connections granted to the agent, whatever the purpose; any member may look. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentIdRequest,
    ): Promise<Array<AgentConnectionResponse>> {
        const result = await this.queryBus.execute(
            new ListAgentConnectionsQuery({ request: { workspaceId, agentId: params.agentId }, principal }),
        )
        return toAgentConnectionsResponse(result)
    }

    /** Grants a connection to the agent, or changes the grant; a manager only. */
    @Put(":connectionId")
    @HttpCode(204)
    grant(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentConnectionIdRequest,
        @Body() input: GrantAgentConnectionRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new GrantAgentConnectionCommand({
                request: {
                    workspaceId,
                    agentId: params.agentId,
                    connectionId: params.connectionId,
                    purpose: input.purpose,
                    access: input.access,
                },
                principal,
            }),
        )
    }

    /** Removes the grant of a connection to the agent; a manager only. */
    @Delete(":connectionId")
    @HttpCode(204)
    revoke(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentConnectionIdRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new RevokeAgentConnectionCommand({
                request: { workspaceId, agentId: params.agentId, connectionId: params.connectionId },
                principal,
            }),
        )
    }
}
