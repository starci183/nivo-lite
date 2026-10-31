import type { GraphMode } from "@modules/domain/agent-graphs"
/** What setAgentGraphMode takes. */
export interface SetAgentGraphModeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** shadow records only, enforced decides. */
    readonly mode: GraphMode
}
