import type { TriggerCondition } from "../../graph/workflow-contract"
import { TRIGGER, type TriggerVerb } from "../../names"
import type { TemplateAgentConfig } from "./graph-builder.types"
import type { TemplateProblem } from "./template-problems"

/**
 * The switch of `TRIGGER_VERB_SHARED` (coordinator's ruling 2026-11-13). ON: the dry run over every installed template agent (blocks-core,
 * nivo-web-core) found no shared verb without disjoint exact conditions, so the refusal holds at definition and at the engine's save.
 */
export const VERB_SHARED_REFUSED = true

/**
 * The verbs a wake reaches by a PIN, never by routing among an agent's workflows: `workflow.called` (an end hand-off and the team chat's
 * router write `WORKFLOW_CALL_MEMBER`, and the engine's `AgentWorkflowRunsService.pinnedOf` picks the named workflow by key). Several
 * graphs of one agent may share them.
 */
const PINNED_VERBS: ReadonlySet<TriggerVerb> = new Set<TriggerVerb>([TRIGGER.workflowCalled])

/** Why a graph's trigger may not share its verb. */
type SharedWhy =
    | "no-where"
    | "several-conditions"
    | `op-not-exact ${TriggerCondition["op"]}`
    | "value-not-scalar"
    | `different-params ${string}`
    | `values-overlap with ${string}`

/** One graph's trigger of a shared verb, with the param and the values its one exact condition keys it by, or why it has none. */
type Keyed =
    | { readonly graph: string; readonly index: number; readonly param: string; readonly values: ReadonlyArray<string> }
    | { readonly graph: string; readonly index: number; readonly why: SharedWhy }

const isScalar = (value: unknown): boolean =>
    value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"

/** The values one condition takes, each as its JSON text (exact equality of JSON scalars), or why it is not an exact key. */
const valuesOf = (condition: TriggerCondition): ReadonlyArray<string> | SharedWhy => {
    if (condition.op === "equals") return isScalar(condition.value) ? [JSON.stringify(condition.value)] : "value-not-scalar"
    if (condition.op === "in")
        return Array.isArray(condition.value) && condition.value.length > 0 && condition.value.every((member) => isScalar(member))
            ? condition.value.map((member) => JSON.stringify(member))
            : "value-not-scalar"
    return `op-not-exact ${condition.op}`
}

const keyedOf = (graph: string, index: number, where: ReadonlyArray<TriggerCondition> | undefined): Keyed => {
    const conditions = where ?? []
    const [only] = conditions
    if (only === undefined) return { graph, index, why: "no-where" }
    if (conditions.length > 1) return { graph, index, why: "several-conditions" }
    const values = valuesOf(only)
    return typeof values === "string" ? { graph, index, why: values } : { graph, index, param: only.param, values }
}

/** Orders two texts by their UTF-16 code units, as an argument-less `sort()` does (locale-free, so the same in every process). */
const compareCodeUnits = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

/** Why each graph of one shared verb is refused, in graph order; empty when every graph keys it disjointly on one param. */
const whysOf = (keyed: ReadonlyArray<Keyed>): ReadonlyArray<{ readonly entry: Keyed; readonly why: SharedWhy }> => {
    const own = keyed.flatMap((entry) => ("why" in entry ? [{ entry, why: entry.why }] : []))
    if (own.length > 0) return own
    const exact = keyed.flatMap((entry) => ("param" in entry ? [entry] : []))
    const params = [...new Set(exact.map((entry) => entry.param))].sort(compareCodeUnits)
    if (params.length > 1) return exact.map((entry) => ({ entry, why: `different-params ${params.join(", ")}` as const }))
    return exact.flatMap((entry) => {
        const overlapping = exact.filter(
            (other) => other.graph !== entry.graph && other.values.some((value) => entry.values.includes(value)),
        )
        return overlapping.length === 0
            ? []
            : [{ entry, why: `values-overlap with ${overlapping.map((other) => other.graph).join(", ")}` as const }]
    })
}

/**
 * The problems of one verb on several graphs of one agent (coordinator's ruling 2026-11-13): one wake starts ONE workflow per agent, so
 * graphs sharing a verb must each key it by EXACTLY ONE condition, `equals` (a JSON scalar) or `in` (a list of them), all on the SAME
 * param, the value sets pairwise disjoint; otherwise each graph at fault is refused (`TRIGGER_VERB_SHARED` at
 * `<agent>.graphs.<graph>.triggers.<i>`, `detail` naming the verb, the graphs and why). Conditions alone decide: graphs bound to other
 * providers' accounts do not make a shared verb legal. A pinned verb (`PINNED_VERBS`) is never judged.
 */
export const sharedVerbProblems = (agent: Pick<TemplateAgentConfig, "key" | "graphs">): ReadonlyArray<TemplateProblem> => {
    const byVerb = new Map<TriggerVerb, Array<Keyed>>()
    for (const graph of agent.graphs)
        graph.spec.triggers.forEach((entry, index) => {
            if (PINNED_VERBS.has(entry.verb)) return
            const list = byVerb.get(entry.verb) ?? []
            list.push(keyedOf(graph.key, index, entry.where))
            byVerb.set(entry.verb, list)
        })
    return [...byVerb.entries()].flatMap(([verb, keyed]) => {
        if (new Set(keyed.map((entry) => entry.graph)).size < 2) return []
        const graphs = keyed.map((entry) => entry.graph).join(", ")
        return whysOf(keyed).map(
            ({ entry, why }): TemplateProblem => ({
                code: "TRIGGER_VERB_SHARED",
                at: `${agent.key}.graphs.${entry.graph}.triggers.${entry.index}`,
                detail: `${verb} shared by ${graphs}: ${why}`,
            }),
        )
    })
}
