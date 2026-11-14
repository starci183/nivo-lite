import type { McpHttpRequest, McpHttpResponse } from "@modules/integrations/mcp"

/** The caller a request to the outbound MCP endpoint proved: the API key (its id), in the only workspace it acts for. */
export interface SurfacePrincipal {
    /** The key id (the credential's subject). */
    readonly keyId: string
    /** The only workspace the key acts for. */
    readonly workspaceId: string
}

/** One HTTP request to the outbound MCP endpoint, from an authenticated key. */
export interface SurfaceRequest {
    /** The workspace the endpoint path names, or null on the canonical `/mcp` (the key names its workspace). */
    readonly pathWorkspaceId: string | null
    /** Who the credential proved. */
    readonly principal: SurfacePrincipal
    /** The HTTP request. */
    readonly http: McpHttpRequest
}

/** What the endpoint answers: the HTTP response the official SDK built. */
export type SurfaceReply = McpHttpResponse

/** What one line of the surface call log says about a data op call. */
export interface SurfaceAuditLine {
    /** Whether the call ran or was refused. */
    readonly outcome: "ok" | "refused"
    /** The refusal code, or null when the call ran. */
    readonly code: string | null
    /** A short summary of the result. */
    readonly summary?: string
}

/** Who a surface call runs as: the key, its holder and role, its agent scope. */
export interface SurfaceActor {
    /** The workspace. */
    readonly workspaceId: string
    /** The key id. */
    readonly keyId: string
    /** The holder's account. */
    readonly userId: string
    /** The holder's workspace role now. */
    readonly seatRole: string
    /** The agent the key is scoped to (it narrows the agent and workflow ops to that agent), or null. */
    readonly agentId: string | null
}
