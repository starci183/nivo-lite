import { Injectable } from "@nestjs/common"
import type { AgentGraphBrief, GraphIntent } from "@modules/domain/agent-turns"
import { AgentGraphsService } from "./agent-graphs.service"

@Injectable()
/**
 * What the action graph lets an agent ask for, as the intents the brief of a turn lists: the actions of the act nodes of the active
 * version, each with the title the owner gave it. Only an enforced graph speaks; a graph in shadow changes nothing the agent is told.
 * The boundaries are not listed: the back end applies them, so they earn no tokens.
 */
export class AgentGraphBriefService implements AgentGraphBrief {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The intents the active version allows; none for an agent with no graph or one still in shadow. */
    async intentsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphIntent>> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state?.mode !== "enforced" || state.active === null) return []
        const intents = state.active.nodes.flatMap((node) =>
            node.step === "write" && node.action !== undefined ? [{ action: node.action, label: node.title }] : [],
        )
        return intents.filter((intent, index) => intents.findIndex((other) => other.action === intent.action) === index)
    }
}
