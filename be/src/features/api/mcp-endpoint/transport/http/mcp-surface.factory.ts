import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { SURFACE_TOOLS } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewaySurfaceService, JsonObject } from "@modules/domain/mcp-gateway"

/** The server NIVO announces to agents. */
const SERVER_INFO = { name: "nivo-mcp-gateway", version: "1.0.0" }

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** One MCP server (official SDK) for one authenticated caller: the three surface tools over the workspace's gateway. */
export const surfaceServerOf = (surface: GatewaySurfaceService, caller: GatewayCaller): Server => {
    const server = new Server(SERVER_INFO, { capabilities: { tools: {} } })
    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: SURFACE_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: { ...tool.inputSchema, type: "object" as const },
        })),
    }))
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const args = isObject(request.params.arguments) ? request.params.arguments : {}
        const answer = await surface.run(caller, request.params.name, args)
        return {
            content: [{ type: "text" as const, text: JSON.stringify(answer.value) }],
            structuredContent: { ...answer.value },
            isError: answer.isError,
        }
    })
    return server
}
