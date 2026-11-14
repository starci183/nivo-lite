import type { AgentRightsAgreeRequest } from "@modules/domain/agent-graphs"

/** What agreeAgentNodeRights takes. */
export interface AgreeAgentNodeRightsRequest extends AgentRightsAgreeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}
