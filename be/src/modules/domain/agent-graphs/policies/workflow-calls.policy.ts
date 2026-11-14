import {
    CALL_WORKFLOW_STEP,
    DEFAULT_ENTRY,
    LATEST_VERSION,
    callProblems,
    mappedOf,
    type ContractProblem,
    type GraphSpec,
    type GraphSpecNode,
    type WorkflowContract,
} from "@nivo-lite/agent-sdk/graph"

/** One workflow of the workspace a hand-off may call: its agent, module, key, the graph it runs and the numbers of its versions. */
export interface CallableWorkflow {
    /** The agent that runs it. */
    readonly agentId: string
    /** The module of that agent, which a hand-off names as `agent`. */
    readonly moduleKey: string
    /** The key within the agent. */
    readonly key: string
    /** The graph of the version it runs now (what `latest` calls). */
    readonly running: GraphSpec
    /** The graph of each version by number (what a pin calls). */
    readonly versions: ReadonlyMap<number, GraphSpec>
}

/** The workflow that saves a graph: its agent and module, and its key (absent for a workflow not made yet). */
export interface SavingWorkflow {
    readonly agentId: string
    readonly moduleKey: string
    readonly key: string | null
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The target an end hand-off node names, or null for any other node. */
const targetOf = (
    node: GraphSpecNode,
): { readonly agent: string; readonly workflow: string; readonly version: number | "latest" } | null => {
    if (node.step !== CALL_WORKFLOW_STEP || !isRecord(node.params)) return null
    const { agent, workflow, version } = node.params
    if (typeof agent !== "string" || typeof workflow !== "string") return null
    return { agent, workflow, version: typeof version === "number" ? version : LATEST_VERSION }
}

/** The contract a graph declares; a graph with none takes no input. */
const contractOf = (graph: GraphSpec): WorkflowContract => graph.contract ?? { inputs: [] }

/**
 * The problems of the end hand-offs of a graph against the workflows they call: the target exists (same module, same key), the pinned
 * version exists, its entry lets this caller in (a workflow open to its own agent only refuses another agent), and the mapping covers
 * its input contract with fitting types and nothing more. The candidates of a module are every agent of it; the one whose agent is the
 * saver's comes first, else the first.
 */
export const callContractProblems = (
    saver: SavingWorkflow,
    graph: GraphSpec,
    callable: ReadonlyArray<CallableWorkflow>,
): ReadonlyArray<ContractProblem> =>
    graph.nodes.flatMap((node): ReadonlyArray<ContractProblem> => {
        const target = targetOf(node)
        if (target === null) return []
        const candidates = callable
            .filter((entry) => entry.moduleKey === target.agent && entry.key === target.workflow)
            .toSorted((left, right) => Number(right.agentId === saver.agentId) - Number(left.agentId === saver.agentId))
        const found = candidates.at(0)
        if (found === undefined) return [{ code: "CALL_TARGET_UNKNOWN", at: node.key }]
        const called = target.version === LATEST_VERSION ? found.running : found.versions.get(target.version)
        if (called === undefined) return [{ code: "CALL_VERSION_UNKNOWN", at: node.key }]
        if ((called.entry ?? DEFAULT_ENTRY).openTo === "agent" && found.agentId !== saver.agentId) {
            return [{ code: "CALL_ENTRY_CLOSED", at: node.key }]
        }
        const inputs = isRecord(node.params) ? node.params.inputs : undefined
        return callProblems(node.key, mappedOf(inputs), contractOf(called))
    })

/** A workflow that calls another, with the graph it runs now. */
export interface CallingWorkflow {
    readonly agentId: string
    readonly key: string
    /** The name the owner knows it by. */
    readonly name: string
    readonly running: GraphSpec
}

/** A caller a new version of a target would break: the caller's name and why. */
export interface BrokenCaller {
    readonly name: string
    readonly problems: ReadonlyArray<ContractProblem>
}

/**
 * The callers a new version of a workflow would break: every workflow that calls it as `latest` and whose mapping no longer covers the
 * new contract, or whose agent the new entry rule shuts out. A pin to an older version is not broken by a new one.
 */
export const brokenCallersOf = (
    target: SavingWorkflow & { readonly key: string },
    graph: GraphSpec,
    callers: ReadonlyArray<CallingWorkflow>,
): ReadonlyArray<BrokenCaller> => {
    const self: CallableWorkflow = {
        agentId: target.agentId,
        moduleKey: target.moduleKey,
        key: target.key,
        running: graph,
        versions: new Map(),
    }
    return callers.flatMap((caller): ReadonlyArray<BrokenCaller> => {
        const latest = caller.running.nodes.filter((node) => {
            const called = targetOf(node)
            return (
                called !== null &&
                called.agent === target.moduleKey &&
                called.workflow === target.key &&
                called.version === LATEST_VERSION
            )
        })
        if (latest.length === 0) return []
        const problems = callContractProblems(
            { agentId: caller.agentId, moduleKey: caller.running.moduleKey, key: caller.key },
            { ...caller.running, nodes: latest },
            [self],
        )
        return problems.length === 0 ? [] : [{ name: caller.name, problems }]
    })
}
