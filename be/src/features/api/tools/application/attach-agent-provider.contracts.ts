import type { AttachmentWish } from "@modules/domain/tools"

/** What attachAgentProvider takes. */
export interface AttachAgentProviderRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connected account to attach. */
    readonly wish: AttachmentWish
}
