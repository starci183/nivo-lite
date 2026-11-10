import type { AttachmentWish } from "@modules/domain/mcp-gateway"

/** What attachAgentProvider takes. */
export interface AttachAgentProviderRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The provider and the abilities wanted. */
    readonly wish: AttachmentWish
}
