import type { AgentRunsQuery } from "@/modules/api"
import type { AgentRunsWire } from "./agentRuns.types"

/** The workflow and version one run executes, as the pin read answers it. */
export interface RunPin {
    readonly runId: string
    readonly workflowId: string
    readonly workflowName: string
    readonly version: number
}

/** A workflow of the agent: its id and its name. */
export interface RunWorkflowName {
    readonly id: string
    readonly name: string
}

/** The key of the runs that no workflow ran (a run from before the workflows). */
const NONE = "none"

/**
 * The runs of the agent keyed by their real workflow: each run takes the workflow and version it is pinned to, and the rail lists the
 * workflows of the agent by name (the ones a pin names that the list no longer holds follow them), then the runs with no workflow.
 */
export const pinnedRunsOf = (
    wire: AgentRunsQuery["agentRuns"],
    pins: ReadonlyArray<RunPin>,
    workflows: ReadonlyArray<RunWorkflowName>,
): AgentRunsWire => {
    const pinOf = new Map(pins.map((pin) => [pin.runId, pin]))
    const runs = wire.runs.map((row) => {
        const pin = pinOf.get(row.id)
        return {
            ...row,
            workflowKey: pin?.workflowId ?? NONE,
            versionNumber: pin?.version ?? null,
            workflowName: pin?.workflowName ?? null,
        }
    })
    const named = new Map(workflows.map((workflow) => [workflow.id, workflow.name]))
    for (const pin of pins) if (!named.has(pin.workflowId)) named.set(pin.workflowId, pin.workflowName)
    const countOf = (key: string): number => runs.filter((row) => row.workflowKey === key).length
    const noneCount = countOf(NONE)
    return {
        ...wire,
        runs,
        workflows: [
            ...[...named].map(([key, name]) => ({ key, name, versionNumber: null, count: countOf(key) })),
            ...(noneCount === 0 ? [] : [{ key: NONE, name: null, versionNumber: null, count: noneCount }]),
        ],
    }
}
