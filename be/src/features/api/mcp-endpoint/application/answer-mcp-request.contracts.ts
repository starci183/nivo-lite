import type { McpHttpRequest } from "@modules/integrations/mcp"

/** What answering one HTTP request of the outbound MCP endpoint takes. */
export interface AnswerMcpRequestRequest {
    /** The workspace the endpoint path names, or null on the canonical `/mcp`. */
    readonly pathWorkspaceId: string | null
    /** The key the credential proved. */
    readonly keyId: string
    /** The only workspace the key acts for. */
    readonly keyWorkspaceId: string
    /** The HTTP request. */
    readonly http: McpHttpRequest
}
