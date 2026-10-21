import type {
    McpCallRequest,
    McpEndpoint,
    McpRemoteResult,
    McpRemoteTool,
    McpReply,
    McpServeRequest,
} from "./mcp.contracts"

/** The client side of MCP: the remote servers a gateway's connectors call. */
export interface McpRemote {
    /** True when the integration holds the credential of that NAME. */
    holds(credentialRef: string): boolean
    /** The tools the server lists. */
    listTools(endpoint: McpEndpoint, timeoutMs: number): Promise<ReadonlyArray<McpRemoteTool>>
    /** Checks that the server answers MCP at all (`ping`). */
    ping(endpoint: McpEndpoint, timeoutMs: number): Promise<void>
    /** Calls one tool by its remote name. */
    call(request: McpCallRequest): Promise<McpRemoteResult>
}

/** The server side of MCP: one JSON-RPC message of a stateless endpoint answered over a caller's tools. */
export interface McpServing {
    /** Answers one message; null body for a notification. */
    answer(request: McpServeRequest): Promise<McpReply>
}
