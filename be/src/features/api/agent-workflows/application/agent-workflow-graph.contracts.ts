import type { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"

/** What agentWorkflowGraph takes. */
export interface AgentWorkflowGraphRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent the Graph page draws. */
    readonly installationId: string
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}

/** What agentWorkflowGraph answers: the Graph page of the agent. */
export type AgentWorkflowGraphResult = Awaited<ReturnType<AgentWorkflowsAdminService["graph"]>>
