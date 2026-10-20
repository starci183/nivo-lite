import type { GrantInput } from "@modules/domain/mcp-gateway"
/** What setMcpToolGrant takes. */
export interface SetMcpToolGrantRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The grant. */
    readonly grant: GrantInput
}
