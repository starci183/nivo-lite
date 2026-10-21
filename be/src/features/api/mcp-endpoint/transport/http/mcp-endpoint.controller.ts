import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Credential, CurrentCredentialPrincipal } from "@modules/domain/identity"
import type { CredentialPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { AnswerMcpRequestCommand } from "../../application/answer-mcp-request.command"
import { McpEndpointPathRequest } from "./dto/mcp-endpoint-path.request"
import { McpEndpointRequest } from "./dto/mcp-endpoint.request"
import { McpEndpointResponse } from "./dto/mcp-endpoint.response"
import { toAnswerMcpRequest, toMcpEndpointResponse } from "./mcp-endpoint.mapper"

@Controller("mcp")
/**
 * POST /mcp/:workspaceId, the one MCP endpoint (stateless Streamable HTTP, JSON responses) of a workspace's gateway. The door takes
 * a per-agent credential (`tool-token`): an API key bound to one agent of the workspace, which names the agent and its workspace;
 * nothing the caller declares is trusted. A revoked key or the key of a deleted agent is refused before any tool runs.
 */
export class McpEndpointController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Answers one JSON-RPC message of an authenticated agent. */
    @Post(":workspaceId")
    @HttpCode(200)
    @Credential({ kind: "tool-token", workflow: "mcp-gateway" })
    async answer(
        @Param() path: McpEndpointPathRequest,
        @CurrentCredentialPrincipal() principal: CredentialPrincipal,
        @Body() body: McpEndpointRequest,
    ): Promise<McpEndpointResponse | null> {
        const reply = await this.commandBus.execute(
            new AnswerMcpRequestCommand({ request: toAnswerMcpRequest(path, principal, body) }),
        )
        return toMcpEndpointResponse(reply)
    }
}
