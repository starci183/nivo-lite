import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpEndpoint, McpRawResult, McpSession } from "./mcp.contracts"

/** The client name NIVO announces to remote servers. */
const CLIENT_INFO = { name: "nivo-mcp-gateway", version: "1.0.0" }

/** Opens a session with the official MCP TypeScript SDK over Streamable HTTP, with the bearer header and the abort signal. */
export const openSdkSession = async (endpoint: McpEndpoint, signal: AbortSignal): Promise<McpSession> => {
    const headers: Record<string, string> =
        endpoint.bearer === null ? {} : { Authorization: `Bearer ${endpoint.bearer}` }
    const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers, signal } })
    const client = new Client(CLIENT_INFO)
    await client.connect(transport, { signal })
    return {
        listTools: () => client.listTools(undefined, { signal }),
        callTool: async (name, args): Promise<McpRawResult> => {
            const result: Readonly<Record<string, unknown>> = await client.callTool(
                { name, arguments: { ...args } },
                undefined,
                { signal },
            )
            return { isError: result.isError, structuredContent: result.structuredContent, content: result.content }
        },
        close: () => client.close(),
    }
}
