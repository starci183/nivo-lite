import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateAgentCommand } from "../../application/create-agent.command"
import { ListAgentsQuery } from "../../application/list-agents.query"
import { RenameAgentCommand } from "../../application/rename-agent.command"
import { SetAgentStatusCommand } from "../../application/set-agent-status.command"
import { SetAgentTextsCommand } from "../../application/set-agent-texts.command"
import { toAgentResponse, toAgentsResponse } from "./agents.mapper"
import { AgentIdRequest } from "./dto/agent-id.request"
import { AgentSummaryResponse } from "./dto/agent.response"
import { CreateAgentRequest } from "./dto/create-agent.request"
import { ListAgentsRequest } from "./dto/list-agents.request"
import { RenameAgentRequest } from "./dto/rename-agent.request"
import { SetAgentStatusRequest } from "./dto/set-agent-status.request"
import { SetAgentTextsRequest } from "./dto/set-agent-texts.request"

@Controller("agents")
/** HTTP doors of the agents of the requested workspace: the instance list and the owner's edits of one agent. */
export class AgentsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the agents of the workspace, oldest first, optionally of one module. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() query: ListAgentsRequest,
    ): Promise<Array<AgentSummaryResponse>> {
        const result = await this.queryBus.execute(
            new ListAgentsQuery({ request: { workspaceId, module: query.module }, principal }),
        )
        return toAgentsResponse(result)
    }

    /** Adds an agent; a manager only, and the handle must be free. */
    @Post()
    async create(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CreateAgentRequest,
    ): Promise<AgentSummaryResponse> {
        const result = await this.commandBus.execute(
            new CreateAgentCommand({ request: { workspaceId, ...input }, principal }),
        )
        return toAgentResponse(result)
    }

    /** Renames an agent; a manager only. */
    @Patch(":agentId/name")
    @HttpCode(204)
    rename(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentIdRequest,
        @Body() input: RenameAgentRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new RenameAgentCommand({ request: { workspaceId, agentId: params.agentId, name: input.name }, principal }),
        )
    }

    /** Pauses or resumes an agent; a manager only. */
    @Patch(":agentId/status")
    @HttpCode(204)
    setStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentIdRequest,
        @Body() input: SetAgentStatusRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new SetAgentStatusCommand({
                request: { workspaceId, agentId: params.agentId, active: input.active },
                principal,
            }),
        )
    }

    /** Replaces the instructions and business notes of an agent; a manager only. */
    @Put(":agentId/texts")
    @HttpCode(204)
    setTexts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: AgentIdRequest,
        @Body() input: SetAgentTextsRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new SetAgentTextsCommand({
                request: {
                    workspaceId,
                    agentId: params.agentId,
                    texts: { instructions: input.instructions, knowledge: input.knowledge },
                },
                principal,
            }),
        )
    }
}
