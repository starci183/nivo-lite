/** Where a remote MCP server answers and the bearer it accepts (already revealed by the caller, never logged). */
export interface McpEndpoint {
    /** The Streamable HTTP endpoint, for example https://hakuen-api.nivo.vn/mcp. */
    readonly url: string
    /** The service-to-service bearer, or null when the server needs none. */
    readonly bearer: string | null
}

/** One tool as a remote server lists it. */
export interface McpRemoteTool {
    /** The remote name, without the gateway namespace. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Its JSON schema. */
    readonly inputSchema: Readonly<Record<string, unknown>>
}

/** What one remote tool call answered: the structured result, or the refusal text. */
export interface McpRemoteResult {
    /** True when the server marked the result as a tool error. */
    readonly isError: boolean
    /** The structured content, else the first text content read as JSON, else `{ text }`. */
    readonly value: Readonly<Record<string, unknown>>
}

/** The pieces of the official SDK the client drives, behind a seam so specs replace them. */
export interface McpSession {
    /** Lists the tools. */
    listTools(): Promise<{ readonly tools: ReadonlyArray<McpRawTool> }>
    /** Calls one tool. */
    callTool(name: string, args: Readonly<Record<string, unknown>>): Promise<McpRawResult>
    /** Closes the session and its transport. */
    close(): Promise<void>
}

/** A tool as the SDK returns it. */
export interface McpRawTool {
    /** The name. */
    readonly name: string
    /** The description. */
    readonly description?: string
    /** The schema. */
    readonly inputSchema: unknown
}

/** A tool result as the SDK returns it. */
export interface McpRawResult {
    /** The error flag. */
    readonly isError?: unknown
    /** The structured content. */
    readonly structuredContent?: unknown
    /** The content blocks. */
    readonly content?: unknown
}

/** Opens one SDK session to an endpoint, aborting with the signal. */
export type McpSessionOpener = (endpoint: McpEndpoint, signal: AbortSignal) => Promise<McpSession>
