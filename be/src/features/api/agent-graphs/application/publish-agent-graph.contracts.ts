import type { AgreedRightRequest } from "@modules/domain/agent-graphs"

/** What publishAgentGraph takes. */
export interface PublishAgentGraphRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** What the change was for. */
    readonly note: string
    /** The operations on connected accounts the owner agrees this activation may bring; absent when nothing was asked of the owner. */
    readonly agreedRights?: ReadonlyArray<AgreedRightRequest> | null
}
