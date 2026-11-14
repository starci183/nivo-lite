import { callEdgesOf, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { Locale } from "@modules/platform/i18n"
import type { WorkflowGraphCall, WorkflowGraphEntry, WorkflowRecord } from "../agent-workflows.contracts"
import { CONTRACT_VIEWS, agentLabelOf } from "./contract-views.policy"

/** A workflow of the workspace a call may land on: its module, key and name, and the agent that runs it. */
export interface WorkflowGraphTarget {
    /** The agent that runs the workflow. */
    readonly agentId: string
    /** The module the workflow belongs to. */
    readonly moduleKey: string
    /** The workflow key. */
    readonly key: string
    /** The name the owner knows it by. */
    readonly name: string
}

/** One call of a workflow with its target named: the workflow's name, and the target agent's words. */
const callOf = (
    call: ReturnType<typeof callEdgesOf>[number],
    agentId: string,
    targets: ReadonlyArray<WorkflowGraphTarget>,
    locale: Locale,
): WorkflowGraphCall => {
    const candidates = targets.filter((target) => target.moduleKey === call.agent && target.key === call.workflow)
    const target = candidates.find((one) => one.agentId === agentId) ?? candidates.at(0)
    return {
        nodeKey: call.nodeKey,
        outcome: call.outcome,
        agent: call.agent,
        agentLabel: agentLabelOf(call.agent, locale) ?? call.agent,
        workflow: call.workflow,
        workflowName: target?.name ?? null,
        version: call.version,
        crossAgent: target === undefined ? true : target.agentId !== agentId,
    }
}

/**
 * One workflow as the agent's Graph page draws it: its name and status, its input contract, its triggers, outcomes and entry rule, and
 * each end hand-off with the outcome it follows and the workflow it calls, named.
 */
export const workflowGraphEntryOf = (
    workflow: WorkflowRecord,
    graph: GraphSpec | null,
    activeNumber: number | null,
    targets: ReadonlyArray<WorkflowGraphTarget>,
    locale: Locale,
): WorkflowGraphEntry => {
    const entry = graph === null ? null : CONTRACT_VIEWS.entryViewOf(graph, locale)
    return {
        id: workflow.id,
        key: workflow.key,
        name: workflow.name,
        status: workflow.status,
        primary: workflow.primary,
        activeNumber,
        entry: entry?.openTo ?? "any",
        entryLabel: entry?.label ?? "",
        inputs: graph?.contract?.inputs.map((input) => ({ ...input })) ?? [],
        triggers:
            graph === null
                ? []
                : CONTRACT_VIEWS.triggerViewsOf(graph, locale).map((trigger) => ({
                      key: trigger.key,
                      sourceKind: trigger.sourceKind,
                      sourceLabel: trigger.sourceLabel,
                      connectionId: trigger.connectionId,
                  })),
        outcomes:
            graph === null
                ? []
                : CONTRACT_VIEWS.outcomeViewsOf(graph, locale).map((outcome) => ({
                      key: outcome.key,
                      label: outcome.label,
                      outputs: outcome.outputs.map((output) => ({ name: output.name, type: output.type })),
                  })),
        calls: graph === null ? [] : callEdgesOf(graph).map((call) => callOf(call, workflow.agentId, targets, locale)),
    }
}
