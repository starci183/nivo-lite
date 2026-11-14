import { Injectable } from "@nestjs/common"
import { AgentWorkflowsService, type ActiveWorkflowGraph } from "@modules/domain/agent-graphs"
import type { Locale } from "@modules/platform/i18n"
import type { AgentFlowsView, DeskFlow } from "./agent-desk.contracts"

@Injectable()
/**
 * How an agent works: its workflows that are on (`active`) with the graph of the version that runs, the primary first, then in the
 * agent's list order. The workflows come from the agent's Graph page read (which, as that page does, adopts the primary workflow from
 * the agent's graph the first time) and the graphs from the read of every running version (a workflow whose running snapshot does not
 * parse has no card); nothing else is written.
 */
export class DeskFlowsService {
    constructor(private readonly workflows: AgentWorkflowsService) {}

    /** The active workflows of the agent with the graph each runs. */
    async flows(workspaceId: string, agentId: string, locale: Locale): Promise<AgentFlowsView> {
        // The Graph page read first: a primary workflow it adopts is then read with the running versions.
        const graph = await this.workflows.graphOf(workspaceId, agentId, locale)
        const running = await this.workflows.activeGraphsOf(workspaceId)
        const graphOf = new Map(
            running
                .filter((one) => one.agentId === agentId)
                .map((one): readonly [string, ActiveWorkflowGraph["graph"]] => [one.workflowId, one.graph]),
        )
        const flows = graph.workflows.flatMap((workflow): ReadonlyArray<DeskFlow> => {
            const runs = graphOf.get(workflow.id)
            if (workflow.status !== "active" || runs === undefined) return []
            return [
                {
                    key: workflow.key,
                    name: workflow.name,
                    isPrimary: workflow.primary,
                    graphJson: JSON.stringify(runs),
                },
            ]
        })
        return { flows: flows.toSorted((a, b) => Number(b.isPrimary) - Number(a.isPrimary)) }
    }
}
