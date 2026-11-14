import type { McpHttpResponse, McpServeRequest } from "./mcp.contracts"

/** The server side of MCP: one HTTP request of a stateless Streamable HTTP endpoint answered over a caller's tools. */
export interface McpServing {
    /** Answers one HTTP request (initialize, ping, tools/list, tools/call, notifications, batches; GET / DELETE: 405). */
    serve(request: McpServeRequest): Promise<McpHttpResponse>
}
