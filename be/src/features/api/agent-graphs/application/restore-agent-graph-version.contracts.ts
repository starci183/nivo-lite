import type { AgreedRightRequest } from "@modules/domain/agent-graphs"

/** What restoreAgentGraphVersion takes. */
export interface RestoreAgentGraphVersionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version to go back to. */
    readonly versionId: string
    /** The operations on connected accounts the owner agrees this activation may bring; absent when nothing was asked of the owner. */
    readonly agreedRights?: ReadonlyArray<AgreedRightRequest> | null
}
