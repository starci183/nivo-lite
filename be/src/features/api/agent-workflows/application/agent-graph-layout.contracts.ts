import type { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"

/** What agentGraphLayout takes. */
export interface AgentGraphLayoutRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose Graph page is laid out. */
    readonly installationId: string
}

/** What agentGraphLayout and saveAgentGraphLayout answer: the layout kept. */
export type AgentGraphLayoutResult = Awaited<ReturnType<AgentWorkflowsAdminService["layout"]>>
