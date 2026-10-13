import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GenerateTextCommand } from "../../application/generate-text.command"
import { GetEngineStatusQuery } from "../../application/get-engine-status.query"
import { RequestAgentSyncCommand } from "../../application/request-agent-sync.command"
import { toEngineStatusResponse, toGenerateRequest, toGenerationResponse, toSyncRequest } from "./agents.mapper"
import { EngineStatusResponse } from "./dto/engine-status.response"
import { GenerateTextRequest } from "./dto/generate-text.request"
import { GenerationResponse } from "./dto/generation.response"
import { RequestAgentSyncRequest } from "./dto/request-agent-sync.request"

@Controller("agents/engine")
/** HTTP doors of the agent engine: its status, the OpenClaw sync and the text generation. */
export class AgentEngineController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Whether the agent engine can answer now; any member may look. */
    @Get("status")
    async status(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<EngineStatusResponse> {
        const result = await this.queryBus.execute(new GetEngineStatusQuery({ request: { workspaceId }, principal }))
        return toEngineStatusResponse(result)
    }

    /** Queues a rebuild of the OpenClaw copy of one instance or of the whole workspace; an owner or manager only. */
    @Post("sync")
    @HttpCode(202)
    sync(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: RequestAgentSyncRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new RequestAgentSyncCommand({ request: toSyncRequest(workspaceId, input), principal }),
        )
    }

    /** Writes a text on the agent engine and answers it, or the reason there is none. */
    @Post("generate")
    @HttpCode(200)
    async generate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: GenerateTextRequest,
    ): Promise<GenerationResponse> {
        const result = await this.commandBus.execute(
            new GenerateTextCommand({ request: toGenerateRequest(workspaceId, input), principal }),
        )
        return toGenerationResponse(result)
    }
}
