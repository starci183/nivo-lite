import { Injectable } from "@nestjs/common"
import type { GraphIntent, IntentNodeKeys, OptionalTurnContracts } from "./agent-graph-brief.contracts"
import type { AgentGraphBrief } from "./agent-graphs.port"
import type { InboundTrust, IntentGap, IntentTrigger } from "@modules/domain/intent-contracts"
import { AgentGraphContractsService } from "./agent-graph-contracts.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { intentOfNode, nodesForTrigger } from "./policies/intent-of-step.policy"

/** The node a turn picks at on a graph that holds none. */
const UNDERSTAND = "understand"

@Injectable()
/**
 * What the action graph lets an agent ask for, as the intents the brief of a turn lists: the actions of the act nodes of the active
 * version, each with the title the owner gave it. A graph the owner set to shadow changes nothing the agent is told. The boundaries are
 * not listed: the backend applies them whatever the model chooses, so they earn no tokens.
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
        trust: InboundTrust,
        source: string | null = null,
    ): Promise<OptionalTurnContracts> {
        return this.contracts.turnContractsOf(workspaceId, agentId, trigger, trust, source)
    }

    /**
     * The nodes the actual trigger and adapter can reach in the active version: the first call, each intent's action and the reply.
     * A caller without a trigger retains the legacy whole-version lookup.
     */
    async nodeKeysOf(
        workspaceId: string,
        agentId: string,
        trigger?: IntentTrigger,
        source?: string,
    ): Promise<IntentNodeKeys> {
        const document = (await this.graphs.stateOfAgent(workspaceId, agentId))?.active
        const whole = document?.nodes ?? []
        const nodes =
            trigger === undefined || document == null ? whole : nodesForTrigger(document, trigger, source ?? null)
        const acts = nodes.flatMap((node) => {
            const intent = intentOfNode(node)
            return intent === null ? [] : [[intent, node.key] as const]
        })
        const reply = nodes.find((node) => node.step === "reply")?.key
        return {
            turn: nodes.find((node) => node.step === "call")?.key ?? UNDERSTAND,
            acts: Object.fromEntries(acts),
            ...(reply === undefined ? {} : { reply }),
        }
    }

    /** Raises the gap of a turn as a proposal to the owner, once per agent and question. */
    raiseGap(gap: IntentGap): Promise<boolean> {
        return this.proposals.raiseGap(gap)
    }

    /** The intents the active version allows; none for an agent with no graph or one in shadow. */
    async intentsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphIntent>> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state?.mode !== "enforced" || state.active === null) return []
        const intents = state.active.nodes.flatMap((node) =>
            node.step === "write" && node.action !== undefined ? [{ action: node.action, label: node.title }] : [],
        )
        return intents.filter((intent, index) => intents.findIndex((other) => other.action === intent.action) === index)
    }
}
