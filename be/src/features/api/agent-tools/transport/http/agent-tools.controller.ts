import { Body, Controller, Get, Headers, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { GetToolManifestQuery } from "../../application/get-tool-manifest.query"
import { RunToolCommand } from "../../application/run-tool.command"
import { toRunToolRequest, toToolManifestResponse, toToolResultResponse } from "./agent-tools.mapper"
import { RunToolRequest } from "./dto/run-tool.request"
import { ToolNameRequest } from "./dto/tool-name.request"
import { ToolManifestResponse, ToolResultResponse } from "./dto/tool-result.response"

@Controller("agent-tools")
/**
 * The HTTP door OpenClaw agents call back into: the tool manifest and one call per tool. The caller is an agent running
 * in the gateway, not a person: a call carries as bearer either the short-lived per-job tool token or the credential the
 * OpenClaw bridge plugin signs for its session (the domain finds the running turn of that session and refuses a call with none);
 * no session is involved.
 */
export class AgentToolsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the tools an agent may call; static text with no workspace data. */
    @Get()
    @Credential({ kind: "tool-token" })
    async manifest(): Promise<ToolManifestResponse> {
        const result = await this.queryBus.execute(new GetToolManifestQuery({ request: {} }))
        return toToolManifestResponse(result)
    }

    /** Runs one tool for the job the bearer token names; the workspace and conversation come from the token only. */
    @Post(":tool")
    @HttpCode(200)
    @Credential({ kind: "tool-token" })
    async run(
        @Headers("authorization") authorization: string | undefined,
        @Param() params: ToolNameRequest,
        @Body() input: RunToolRequest,
    ): Promise<ToolResultResponse> {
        const result = await this.commandBus.execute(
            new RunToolCommand({ request: toRunToolRequest(authorization, params.tool, input) }),
        )
        return toToolResultResponse(result)
    }
}
