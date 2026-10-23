import type { Secret } from "@modules/platform/config"

/** A JSON object as MCP carries it: tool arguments, results and JSON-RPC messages. */
export interface McpJson {
    /** Any member. */
    readonly [member: string]: unknown
}

/** Where a remote MCP server answers and the bearer credential it accepts, opened by the caller from its sealed row. */
export interface McpEndpoint {
    /** The Streamable HTTP endpoint, for example https://shop.example.com/mcp. */
    readonly url: string
    /** The bearer credential, or null when the server takes none; revealed only into the request header. */
    readonly bearer: Secret | null
}

/** One tool as a remote server lists it. */
export interface McpRemoteTool {
    /** The remote name, without the gateway namespace. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Its JSON schema. */
    readonly inputSchema: McpJson
    /** The server's behaviour hints (`readOnlyHint`, ...), or empty; hints, never authority. */
    readonly annotations: McpJson
    /** The server's `_meta` of the tool (a NIVO capability role travels as `nivo/role`), or empty. */
    readonly meta: McpJson
}

/** What one remote tool call answered: the structured result, or the refusal text. */
export interface McpRemoteResult {
    /** True when the server marked the result as a tool error. */
    readonly isError: boolean
    /** The structured content, else the first text content read as JSON, else `{ text }`. */
    readonly value: McpJson
}

/** One call of a remote tool. */
export interface McpCallRequest {
    /** The server. */
    readonly endpoint: McpEndpoint
    /** The remote tool name. */
    readonly name: string
    /** Its arguments. */
    readonly args: McpJson
    /** The time limit of the whole session, milliseconds. */
    readonly timeoutMs: number
}

/** A tool result as the SDK returns it; members it does not name are ignored. */
export interface McpRawResult {
    /** Any other member. */
    readonly [member: string]: unknown
    /** The error flag. */
    readonly isError?: unknown
    /** The structured content. */
    readonly structuredContent?: unknown
    /** The content blocks. */
    readonly content?: unknown
}

/** One tool a served MCP endpoint lists. */
export interface McpServedTool {
    /** The name. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Its JSON schema (an object schema). */
    readonly inputSchema: McpJson
}

/** What a served tool answered. */
export interface McpServedResult {
    /** The JSON result. */
    readonly value: McpJson
    /** True when the call did not succeed. */
    readonly isError: boolean
}

/** The tools an endpoint serves and how one is run, for one already authenticated caller. */
export interface McpSurface {
    /** The tools `tools/list` answers. */
    readonly tools: ReadonlyArray<McpServedTool>
    /** Runs one tool of the list (`tools/call`). */
    call(name: string, args: McpJson): Promise<McpServedResult>
}

/** One JSON-RPC message an endpoint received, and the surface that answers it. */
export interface McpServeRequest {
    /** The parsed request body. */
    readonly message: unknown
    /** The tools of the caller. */
    readonly surface: McpSurface
}

/** A JSON-RPC 2.0 response: the result of a request, or its error. */
export interface McpRpcResponse {
    /** Always "2.0". */
    readonly jsonrpc: "2.0"
    /** The id of the request answered; null when the message was not one. */
    readonly id: string | number | null | undefined
    /** The result of a successful request. */
    readonly result?: unknown
    /** The error of a refused request. */
    readonly error?: unknown
}

/** The JSON-RPC answer of one message: the response, or null for a notification (nothing to answer). */
export interface McpReply {
    /** The JSON-RPC response, or null. */
    readonly body: McpRpcResponse | null
}
