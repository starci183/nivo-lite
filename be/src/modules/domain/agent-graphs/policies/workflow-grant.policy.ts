import type { GraphSpecGrant } from "@nivo-lite/agent-sdk/graph"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"

/** A grant that holds nothing: what an agent with no running graph holds, so a workflow of it reaches nothing. */
export const EMPTY_GRANT: GraphSpecGrant = { rights: [], tools: [], effects: [] }

/**
 * What one step of a run may reach. `effects` is null for a run of the agent's own graph (its primary workflow), whose effects the node
 * definitions and the installed effects bound as before; a list for a run of any other workflow, whose steps may only run those.
 */
export interface RunGrant {
    /** The data rights. */
    readonly rights: ReadonlyArray<DataRight>
    /** The NIVO MCP tools, by name. */
    readonly tools: ReadonlyArray<string>
    /** The effects, by id, or null when the run's graph is the agent's own. */
    readonly effects: ReadonlyArray<string> | null
}

/**
 * What a run of a workflow other than the agent's own graph may reach: what its OWN graph declares, with its effects and NIVO MCP tools
 * bounded by the tool set the agent's module declares (`agent.tools` in blocks-core), the hard right "a step's tools ⊂ the workflow's
 * grant ⊂ the agent's tool set". The data rights are the workflow's own as declared (checked when it is saved). A tool the agent may
 * never use is never reached, whatever the workflow declares; the agent's primary workflow does not bound another workflow.
 * `agentTools` null (the module declares no agent) reaches no tool and no effect. Pure.
 */
export const workflowRunGrantOf = (own: GraphSpecGrant, agentTools: ReadonlyArray<string> | null): RunGrant => {
    const held = new Set(agentTools ?? [])
    return {
        rights: own.rights,
        tools: own.tools.filter((tool) => held.has(tool)),
        effects: own.effects.filter((effect) => held.has(effect)),
    }
}

/** What a run of the agent's own graph may reach: its grant as it stands, its effects bounded as before. */
export const ownRunGrantOf = (grant: GraphSpecGrant): RunGrant => ({
    rights: grant.rights,
    tools: grant.tools,
    effects: null,
})

/** The effects a step's node may run that the run's grant does not hold, in the node's order; empty when it holds them all. */
export const effectsBeyond = (nodeEffects: ReadonlyArray<string>, grant: RunGrant): ReadonlyArray<string> => {
    const { effects } = grant
    return effects === null ? [] : nodeEffects.filter((effect) => !effects.includes(effect))
}
