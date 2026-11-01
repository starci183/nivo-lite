import type { GraphDocument, GraphNode, GraphNodeKind, GraphNodeStep, TriggerStep } from "../agent-graphs.contracts"
import { successorsOf } from "./graph-problems.policy"

/** One node a run went through. */
export interface TraceStep {
    /** The node. */
    readonly key: string
    /** Its title, in the owner's words. */
    readonly title: string
    /** Whether it is a trigger, a condition, an execute step or an output. */
    readonly kind: GraphNodeKind
    /** Which one it is within its kind. */
    readonly step: GraphNodeStep
    /** On a condition, the branch the run took; null elsewhere. */
    readonly branchKey: string | null
}

/** The run a trace is drawn for: the action that was decided, the branch taken and the trigger that woke the agent. */
export interface RunToTrace {
    /** The action key the condition decided. */
    readonly action: string
    /** The branch the condition took. */
    readonly branchKey: string
    /** The trigger that woke the agent, or null when it is not known. */
    readonly trigger: TriggerStep | null
}

/** The wake sources, as the trigger node each one starts. */
const TRIGGER_OF_SOURCE: Readonly<Record<string, TriggerStep>> = {
    customer: "customer_message",
    tag: "tag",
    internal: "event",
    schedule: "schedule",
}

/** The trigger a wake source starts, or null when the wake is gone or the source is not one the graph knows. */
export const triggerStepOf = (source: string | null): TriggerStep | null =>
    source === null ? null : (TRIGGER_OF_SOURCE[source] ?? null)

const MAX_STEPS = 60

const stepOf = (node: GraphNode, branchKey: string | null): TraceStep => ({
    key: node.key,
    title: node.title,
    kind: node.kind,
    step: node.step,
    branchKey,
})

/** True when walking forward from `from` can reach `target`. */
const reaches = (byKey: ReadonlyMap<string, GraphNode>, from: string, target: string): boolean => {
    const seen = new Set<string>()
    const queue = [from]
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        if (key === target) return true
        const node = byKey.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            queue.push(...successorsOf(node))
        }
    }
    return false
}

/**
 * The nodes a run went through, from the trigger that woke the agent to an output, as the version that decided drew them: it walks
 * forward from the trigger toward the condition of the action, takes the branch the decision recorded there, and goes on to an
 * output. Where a node leads to several, the one that can reach the condition is taken. A trigger the graph has no node for starts
 * from its first trigger.
 */
export const runTraceOf = (document: GraphDocument, run: RunToTrace): ReadonlyArray<TraceStep> => {
    const byKey = new Map(document.nodes.map((node) => [node.key, node]))
    const triggers = document.nodes.filter((node) => node.kind === "trigger")
    const condition = document.nodes.find((node) => node.decide?.intent === run.action)
    const start = triggers.find((node) => node.step === run.trigger) ?? triggers[0]
    const steps: Array<TraceStep> = []
    for (let current = start; current !== undefined && steps.length < MAX_STEPS;) {
        const { decide } = current
        const taken = decide?.intent === run.action ? run.branchKey : null
        steps.push(stepOf(current, taken))
        const options =
            decide === undefined || taken === null
                ? successorsOf(current)
                : decide.branches.filter((branch) => branch.key === taken).map((branch) => branch.next)
        const next =
            condition === undefined || steps.some((entry) => entry.key === condition.key)
                ? options[0]
                : (options.find((key) => reaches(byKey, key, condition.key)) ?? options[0])
        current = next === undefined || steps.some((entry) => entry.key === next) ? undefined : byKey.get(next)
    }
    return steps
}
