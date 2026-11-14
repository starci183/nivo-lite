import type { AgreedRightRequest } from "@modules/domain/agent-graphs"

/** What setAgentWorkflowStatus takes. */
export interface SetAgentWorkflowStatusRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** active, draft or paused. */
    readonly status: string
    /** The operations on connected accounts the owner agrees this activation may bring; absent when nothing was asked of the owner. */
    readonly agreedRights?: ReadonlyArray<AgreedRightRequest> | null
}
