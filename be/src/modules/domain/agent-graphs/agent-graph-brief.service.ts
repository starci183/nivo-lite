import { Injectable } from "@nestjs/common"
import type { AgentGraphBrief, GraphIntent, IntentNodeKeys } from "@modules/domain/agent-turns"
import type { IntentAudience, IntentGap, IntentTrigger } from "@modules/domain/intent-contracts"
import { AgentGraphContractsService } from "./agent-graph-contracts.service"
import type { OptionalTurnContracts } from "./agent-graph-contracts.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService } from "./agent-graphs.service"

/** The node a turn picks at on a graph that holds none. */
const UNDERSTAND = "understand"

@Injectable()
/**
 * What the action graph lets an agent ask for, as the intents the brief of a turn lists: the actions of the act nodes of the active
 * version, each with the title the owner gave it. Only an enforced graph speaks; a graph in shadow changes nothing the agent is told.
 * The boundaries are not listed: the back end applies them, so they earn no tokens.
 */
export class AgentGraphBriefService implements AgentGraphBrief {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly contracts: AgentGraphContractsService,
        private readonly proposals: AgentGraphProposalsService,
    ) {}

    /** The contracts the trigger of a turn reaches in the published version, or null when the turn stays on the prompt it had. */
    contractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        audience: IntentAudience,
    ): Promise<OptionalTurnContracts> {
        return this.contracts.turnContractsOf(workspaceId, agentId, trigger, audience)
    }

    /**
     * The nodes of the active version the steps of a turn stand for: the node where the trigger path picks what to do (the first call
     * node, else `understand`) and the act node of each intent, so a trace can be compared with the published graph.
     */
    async nodeKeysOf(workspaceId: string, agentId: string): Promise<IntentNodeKeys> {
        const nodes = (await this.graphs.stateOfAgent(workspaceId, agentId))?.active?.nodes ?? []
        const acts = nodes.flatMap((node) =>
            node.step === "write" && node.action !== undefined ? [[node.action, node.key] as const] : [],
        )
        return { turn: nodes.find((node) => node.step === "call")?.key ?? UNDERSTAND, acts: Object.fromEntries(acts) }
    }

    /** Raises the gap of a turn as a proposal to the owner, once per agent and question. */
    raiseGap(gap: IntentGap): Promise<boolean> {
        return this.proposals.raiseGap(gap)
    }

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
