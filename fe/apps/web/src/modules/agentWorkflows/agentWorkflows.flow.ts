import type { FlowGraphTone } from "@starci/grammar/common"
import { type GraphView } from "@/modules/plugin-registry"
import { graphOfSpec, specOf, stepsMapOf } from "@/modules/workflowSteps"
import type { WorkflowContext } from "./agentWorkflows.types"
import type { StepsMapView, WorkflowMark } from "@/modules/types"

/** The tone a mark paints. */
const MARK_TONES: Readonly<Record<WorkflowMark, FlowGraphTone>> = {
    added: "success",
    removed: "danger",
    changed: "warning",
}

/** The graph view of a graph written as JSON text, in the language of the page; empty for a text that is not a graph. */
export const graphOfJson = (json: string | null, context: WorkflowContext): GraphView =>
    graphOfSpec(specOf(json), context.locale)

/** What a step of either side of a diff is called: its card title and line, and the words of each of its settings. */
export interface StepWordsOf {
    readonly title: string
    readonly line: string
    readonly params: ReadonlyMap<string, string>
}

/** The words of every step of two graphs by node key, the newer side first, so a diff never names a step by its key. */
export const stepWordsOf = (graphs: ReadonlyArray<GraphView>): ReadonlyMap<string, StepWordsOf> => {
    const words = new Map<string, StepWordsOf>()
    for (const graph of graphs)
        for (const node of graph.nodes)
            if (!words.has(node.id))
                words.set(node.id, {
                    title: node.title ?? node.label,
                    line: node.subtitle ?? node.description ?? "",
                    params: new Map((node.paramFields ?? []).map((field) => [field.name, field.label])),
                })
    return words
}

/**
 * The card map of a graph written as JSON text (`layout="steps"`). Given a diff, it also draws the steps the graph lost (dashed, from
 * the graph before) and paints each step by what happened to it, the mark as its corner tag, so what changed reads at a glance and
 * the rest recedes.
 */
export const flowOfGraph = (
    afterJson: string | null,
    beforeJson: string | null,
    marks: ReadonlyMap<string, WorkflowMark>,
    context: WorkflowContext,
): StepsMapView => {
    const after = graphOfJson(afterJson, context)
    const before = graphOfJson(beforeJson, context)
    const afterKeys = new Set(after.nodes.map((node) => node.id))
    const gone = before.nodes.filter((node) => marks.get(node.id) === "removed" && !afterKeys.has(node.id))
    const goneKeys = new Set(gone.map((node) => node.id))
    const keys = new Set([...afterKeys, ...goneKeys])
    const goneEdges = before.edges.filter(
        (edge) => (goneKeys.has(edge.from) || goneKeys.has(edge.to)) && keys.has(edge.from) && keys.has(edge.to),
    )
    const map = stepsMapOf({ nodes: [...after.nodes, ...gone], edges: [...after.edges, ...goneEdges] }, context.locale)
    const goneEdgeIds = new Set(goneEdges.map((edge) => edge.id))
    return {
        ...map,
        nodes: map.nodes.map((node) => {
            const mark = marks.get(node.id)
            return {
                ...node,
                ...(mark === undefined ? {} : { tone: MARK_TONES[mark], tag: context.t(`mark_${mark}`) }),
                ...(marks.size > 0 && mark === undefined ? { isDimmed: true } : {}),
                ...(goneKeys.has(node.id) ? { isPlaceholder: true } : {}),
            }
        }),
        edges: map.edges.map((edge) => (goneEdgeIds.has(edge.id) ? { ...edge, isPlaceholder: true } : edge)),
    }
}
