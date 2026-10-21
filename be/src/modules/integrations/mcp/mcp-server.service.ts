import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import {
    CallToolRequestSchema,
    ErrorCode,
    isJSONRPCRequest,
    JSONRPCMessageSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js"
import { Injectable } from "@nestjs/common"
import type { McpJson, McpReply, McpRpcResponse, McpServeRequest, McpSurface } from "./mcp.contracts"
import type { McpServing } from "./mcp.port"

/** The server NIVO announces to agents. */
const SERVER_INFO = { name: "nivo-mcp-gateway", version: "1.0.0" }

/** The answer to a body that is not one JSON-RPC message (a batch, a malformed object). */
const INVALID_REQUEST: McpRpcResponse = {
    jsonrpc: "2.0",
    id: null,
    error: { code: ErrorCode.InvalidRequest, message: "Invalid Request" },
}

const isJson = (value: unknown): value is McpJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The message without its undefined members (a validated request class defines every declared member, absent or not). */
const settled = (message: unknown): unknown =>
    isJson(message) ? Object.fromEntries(Object.entries(message).filter(([, value]) => value !== undefined)) : message

/** One MCP server (official SDK) over the surface of one caller: `tools/list` lists its tools, `tools/call` runs one. */
const serverOf = (surface: McpSurface): McpServer => {
    const mcp = new McpServer(SERVER_INFO, { capabilities: { tools: {} } })
    mcp.server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: surface.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: { ...tool.inputSchema, type: "object" as const },
        })),
    }))
    mcp.server.setRequestHandler(CallToolRequestSchema, async (call) => {
        const args = isJson(call.params.arguments) ? call.params.arguments : {}
        const answer = await surface.call(call.params.name, args)
        return {
            content: [{ type: "text" as const, text: JSON.stringify(answer.value) }],
            structuredContent: { ...answer.value },
            isError: answer.isError,
        }
    })
    return mcp
}

@Injectable()
/**
 * The server side of MCP for a stateless Streamable HTTP endpoint with JSON responses: one POSTed JSON-RPC message in, its one
 * response out. The official SDK runs the protocol (initialize, ping, tools/list, tools/call, the JSON-RPC errors) over a transport
 * that carries exactly that message; a notification or a response is accepted with nothing to answer.
 */
export class McpServerService implements McpServing {
    /** Answers one JSON-RPC message for the caller whose tools the surface holds. */
    async answer(request: McpServeRequest): Promise<McpReply> {
        const message = settled(request.message)
        if (isJSONRPCRequest(message)) return { body: await this.reply(message, request.surface) }
        return { body: JSONRPCMessageSchema.safeParse(message).success ? null : INVALID_REQUEST }
    }

    private async reply(message: JSONRPCRequest, surface: McpSurface): Promise<McpRpcResponse> {
        const mcp = serverOf(surface)
        const body = await new Promise<McpRpcResponse>((resolve, reject) => {
            const transport: Transport = {
                start: () => Promise.resolve(),
                close: () => Promise.resolve(),
                send: (answer) => {
                    resolve({ id: null, ...answer })
                    return Promise.resolve()
                },
            }
            void mcp.connect(transport).then(() => transport.onmessage?.(message), reject)
        })
        await mcp.close()
        return body
    }
}
