import { Injectable } from "@nestjs/common"
import { InjectMcpServer } from "@modules/integrations/mcp"
import type { McpServedResult, McpServedTool, McpServing } from "@modules/integrations/mcp"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import {
    GATEWAY_CALL_INPUT_SCHEMA,
    GATEWAY_DESCRIBE_INPUT_SCHEMA,
    GATEWAY_SEARCH_INPUT_SCHEMA,
    gatewayCallSchema,
    gatewayDescribeSchema,
    gatewaySearchSchema,
} from "./gateway-tools.schema"
import type { GatewayCall } from "./gateway-tools.schema"
import type { GatewayCaller, GatewayJson, SurfaceReply, SurfaceRequest } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"

const SEARCH_LIMIT_DEFAULT = 5

/**
 * The three tools every agent sees on the gateway's single MCP endpoint, however many connectors the workspace has: search the tools
 * granted to it, describe one (schema and limits), and call one. Every call goes through `McpGatewayService.call`, so the grants, the
 * approval, the breaker, the time limit and the audit apply to agents exactly as to NIVO's own performers.
 */
const SURFACE_TOOLS: ReadonlyArray<McpServedTool> = [
    {
        name: "tool.search",
        description:
            "Find, by name and description, the connector tools you may use (installed, approved and granted to you), for example 'spa slots' or 'bank transactions'. Answers at most 10.",
        inputSchema: GATEWAY_SEARCH_INPUT_SCHEMA,
    },
    {
        name: "tool.describe",
        description: "The JSON schema, mode and limits of one tool, by its full name (for example shop.order.place).",
        inputSchema: GATEWAY_DESCRIBE_INPUT_SCHEMA,
    },
    {
        name: "tool.call",
        description:
            "Call one tool by its full name with its arguments. Writes require an opKey, reused on retries of the same intended operation. A call over your limits waits for a person's approval.",
        inputSchema: GATEWAY_CALL_INPUT_SCHEMA,
    },
]

const INVALID_ARGUMENTS: McpServedResult = { value: { error: "invalid_arguments" }, isError: true }

@Injectable()
/**
 * The gateway's own MCP endpoint for one authenticated agent: the credential names the agent and the only workspace it acts for, so
 * nothing in the request (no header, no argument) can make it another agent or reach another workspace.
 */
export class GatewaySurfaceService {
    constructor(
        @InjectMcpServer() private readonly server: McpServing,
        private readonly gateway: McpGatewayService,
    ) {}

    /** Answers one JSON-RPC message of the endpoint of a workspace; a credential of another workspace is refused. */
    answer(request: SurfaceRequest): Promise<SurfaceReply> {
        if (request.principal.workspaceId !== request.workspaceId) {
            return Promise.reject(new McpGatewayError({ code: McpGatewayErrorCode.WorkspaceMismatch }))
        }
        const caller: GatewayCaller = {
            workspaceId: request.workspaceId,
            agentId: request.principal.agentId,
            conversationId: null,
            workItemId: null,
        }
        return this.server.answer({
            message: request.message,
            surface: { tools: SURFACE_TOOLS, call: (tool, args) => this.run(caller, tool, args) },
        })
    }

    /** Runs one surface tool. */
    private async run(caller: GatewayCaller, tool: string, args: GatewayJson): Promise<McpServedResult> {
        if (tool === "tool.search") {
            const parsed = gatewaySearchSchema.safeParse(args)
            if (!parsed.success) return INVALID_ARGUMENTS
            const tools = await this.gateway.search(
                caller,
                parsed.data.query,
                parsed.data.limit ?? SEARCH_LIMIT_DEFAULT,
            )
            return { value: { tools }, isError: false }
        }
        if (tool === "tool.describe") {
            const parsed = gatewayDescribeSchema.safeParse(args)
            if (!parsed.success) return INVALID_ARGUMENTS
            const described = await this.gateway.describe(caller, parsed.data.name)
            return described === null
                ? { value: { error: "not_granted_or_unknown" }, isError: true }
                : { value: { ...described }, isError: false }
        }
        if (tool === "tool.call") {
            const parsed = gatewayCallSchema.safeParse(args)
            if (!parsed.success) return INVALID_ARGUMENTS
            return this.call(caller, parsed.data)
        }
        return { value: { error: "unknown_tool" }, isError: true }
    }

    /** Requires the client's stable operation identity before a write can reach a connector. */
    private async call(caller: GatewayCaller, args: GatewayCall): Promise<McpServedResult> {
        const name = args.name
        const opKey = (args.opKey ?? "").trim()
        if (opKey === "") {
            const described = await this.gateway.describe(caller, name)
            if (described === null) return { value: { error: "not_granted_or_unknown" }, isError: true }
            if (described.scope !== "read") return { value: { error: "idempotency_key_required" }, isError: true }
        }
        const result = await this.gateway.call(
            opKey === "" ? caller : { ...caller, opKey: `mcp:${caller.agentId}:${opKey}` },
            name,
            args.arguments ?? {},
        )
        return result.ok ? { value: result.value, isError: false } : { value: { ...result }, isError: true }
    }
}
