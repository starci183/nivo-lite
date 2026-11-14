import type { GraphSpecGrant } from "@nivo-lite/agent-sdk/graph"
import { CONTROL_EFFECTS } from "@modules/domain/installed-plugins"
import { withDefaultReads } from "./agent-tools.policy"

/** A grant that holds nothing: what an agent with no running graph holds, so a workflow of it reaches nothing. */
export const EMPTY_GRANT: GraphSpecGrant = { tools: [], effects: [] }

/**
 * What one step of a run may reach. `effects` is null for a run of the agent's own graph (its primary workflow), whose effects the node
 * definitions and the installed effects bound as before; a list for a run of any other workflow, whose steps may only run those.
 */
export interface RunGrant {
    /** The NIVO MCP tools, by name. */
    readonly tools: ReadonlyArray<string>
    /** The effects, by id, or null when the run's graph is the agent's own. */
    readonly effects: ReadonlyArray<string> | null
}

/**
 * What a run of a workflow other than the agent's own graph may reach: what its OWN graph declares, with its effects and NIVO MCP tools
 * bounded by the tool set the agent's module declares (`agent.tools` in blocks-core), the hard right "a step's tools ⊂ the workflow's
 * grant ⊂ the agent's tool set". There is no data right (`nivo-frame.rights`): a step's reach is its declared tools. A tool the agent may
 * never use is never reached, whatever the workflow declares (the default reads of the context sources are held by every agent and
 * join every run's tools: `withDefaultReads`, the ONE set "what this agent may call", which the save check reads too); the agent's primary
 * workflow does not bound another workflow. A control step's own effect (`core.call-workflow`'s tag: `CONTROL_EFFECTS`) is the engine's,
 * granted by the step itself, so it is kept whatever the agent declares. `agentTools` null (the module declares no agent) reaches no
 * tool and no effect. Pure.
 */
export const workflowRunGrantOf = (own: GraphSpecGrant, agentTools: ReadonlyArray<string> | null): RunGrant => {
    const held = new Set(agentTools === null ? [] : withDefaultReads(agentTools))
    return {
        tools: agentTools === null ? [] : withDefaultReads(own.tools.filter((tool) => held.has(tool))),
        effects: agentTools === null ? [] : own.effects.filter((effect) => held.has(effect) || CONTROL_EFFECTS.has(effect)),
    }
}

/** What a run of the agent's own graph may reach: its grant as it stands, its effects bounded as before. */
export const ownRunGrantOf = (grant: GraphSpecGrant): RunGrant => ({
    tools: withDefaultReads(grant.tools),
    effects: null,
})

/** The effects a step's node may run that the run's grant does not hold, in the node's order; empty when it holds them all. */
export const effectsBeyond = (nodeEffects: ReadonlyArray<string>, grant: RunGrant): ReadonlyArray<string> => {
    const { effects } = grant
    return effects === null ? [] : nodeEffects.filter((effect) => !effects.includes(effect))
}
