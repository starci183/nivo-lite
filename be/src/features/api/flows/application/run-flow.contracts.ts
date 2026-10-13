import type { FlowRequest } from "@modules/domain/flows"

/** What run flow takes. */
export interface RunFlowRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** What to do. */
    readonly flow: FlowRequest
}
