/** A JSON object as MCP carries it: tool arguments, results and JSON-RPC messages. */
export interface McpJson {
    /** Any member. */
    readonly [member: string]: unknown
}

/** The MCP tool annotations a served tool carries (hints a client shows its user; never trusted for safety by NIVO itself). */
export interface McpToolAnnotations {
    /** A short display name. */
    readonly title: string
    /** True when the tool changes nothing. */
    readonly readOnlyHint: boolean
    /** True when the tool may change something a person cannot take back: the client asks its user first. */
    readonly destructiveHint: boolean
    /** True when calling again with the same arguments changes nothing more. */
    readonly idempotentHint: boolean
    /** False: the tool reaches only the workspace's own NIVO data, never an open world. */
    readonly openWorldHint: boolean
}

/** One tool a served MCP endpoint lists. */
export interface McpServedTool {
    /** The name (`[a-zA-Z0-9_-]`, what every Claude client accepts). */
    readonly name: string
    /** A short display name. */
    readonly title: string
    /** What it does. */
    readonly description: string
    /** Its input JSON Schema (an object schema). */
    readonly inputSchema: McpJson
    /** Its output JSON Schema (an object schema): the result's `structuredContent` conforms to it. */
    readonly outputSchema: McpJson
    /** Its annotations. */
    readonly annotations: McpToolAnnotations
    /** NIVO's own metadata (`nivo/op`: the `nivo.api.nivo.*` name a direct tool runs). */
    readonly meta: McpJson
}

/** What a served tool answered: the structured result and the compact text a client shows, or a tool error. */
export interface McpServedResult {
    /** The structured result (conforms to the tool's output schema when the call succeeded). */
    readonly value: McpJson
    /** The compact text block that travels beside it. */
    readonly text: string
    /** True when the call did not succeed (a tool execution error, MCP `isError`). */
    readonly isError: boolean
}

/** The tools an endpoint serves and how one is run, for one already authenticated caller. */
export interface McpSurface {
    /** The guidance `initialize` answers (`instructions`). */
    readonly instructions: string
    /** The tools `tools/list` answers. */
    readonly tools: ReadonlyArray<McpServedTool>
    /** Runs one tool of the list (`tools/call`); a name not in the list never reaches it. */
    call(name: string, args: McpJson): Promise<McpServedResult>
}

/** One HTTP request to the MCP endpoint, as the web server received it (its JSON body already parsed). */
export interface McpHttpRequest {
    /** The HTTP method. */
    readonly method: string
    /** The absolute URL of the request. */
    readonly url: string
    /** The request headers (lower-case names). */
    readonly headers: Readonly<Record<string, string>>
    /** The parsed JSON body (undefined for a request without one). */
    readonly body: unknown
}

/** The HTTP answer of the MCP endpoint, as the official SDK built it. */
export interface McpHttpResponse {
    /** The status. */
    readonly status: number
    /** The response headers. */
    readonly headers: Readonly<Record<string, string>>
    /** The body text (empty for a 202 or a 405). */
    readonly body: string
}

/** One HTTP request to serve, and the surface that answers it. */
export interface McpServeRequest {
    /** The HTTP request. */
    readonly request: McpHttpRequest
    /** The tools of the caller. */
    readonly surface: McpSurface
}
