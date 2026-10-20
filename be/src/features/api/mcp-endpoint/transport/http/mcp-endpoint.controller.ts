import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { Controller, Headers, Param, Post, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { GatewaySurfaceService } from "@modules/domain/mcp-gateway"
import { surfaceServerOf } from "./mcp-surface.factory"

const UNAUTHORIZED = 401

@Controller("mcp")
/**
 * POST /mcp/:workspaceId, the one MCP endpoint (Streamable HTTP, stateless JSON) of a workspace's gateway. An agent presents
 * `Authorization: Bearer <MCP_GATEWAY_AGENT_TOKEN>` and `X-Nivo-Agent: <agentId>`; it then sees three tools (search, describe, call)
 * whatever the number of connectors, and every call goes through the gateway's grants, approvals, time limits and audit.
 */
export class McpEndpointController {
    constructor(private readonly surface: GatewaySurfaceService) {}

    /** Serves one JSON-RPC request of an authenticated agent. */
    @Post(":workspaceId")
    async handle(
        @Param("workspaceId") workspaceId: string,
        @Headers("authorization") authorization: string | undefined,
        @Headers("x-nivo-agent") agentId: string | undefined,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const caller = await this.surface.authenticate(workspaceId, agentId ?? "", authorization)
        if (caller === null) {
            response.status(UNAUTHORIZED).json({ error: "unauthorized" })
            return
        }
        const server = surfaceServerOf(this.surface, caller)
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
        response.on("close", () => {
            void transport.close()
            void server.close()
        })
        await server.connect(transport)
        const body: unknown = request.body
        await transport.handleRequest(request, response, body)
    }
}
