import type { GraphView } from "@nivo-lite/blocks-core/graph"
import { graphOfSpec, nodeOfKey, specOf } from "@/modules/workflowSteps"
import type { StepsLocale } from "@/modules/workflowSteps"
import type { RunGraphNode } from "@/modules/types"
import type { AgentRunStepWire } from "./agentRuns.types"

/** A title a person can read: a title with words stays as it is, a raw node key ("paymentEvidence", "match-code") becomes plain words. */
export const humanLabelOf = (text: string): string => {
    if (text.includes(" ")) return text
    const words = text
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[-_.]+/g, " ")
        .trim()
        .toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The catalogue's name for a node key (without its separators, lower case), or undefined when the catalogue has none. */
export type NodeNamer = (squashedKey: string) => string | undefined

/** The name of a node by its key: the catalogue's name for the key when it has one, else the words of the key. */
export const nodeNameOf = (key: string, nameOf: NodeNamer): string =>
    nameOf(key.replace(/[-_.\s]+/g, "").toLowerCase()) ?? humanLabelOf(key)

/** The graph of a run: each node of the flow with its title and where it goes, and the card view of the whole flow. */
export interface RunGraph {
    readonly nodes: ReadonlyArray<RunGraphNode>
    readonly view: GraphView
}

/** A graph with nothing in it, while the agent graph is not read yet. */
export const EMPTY_RUN_GRAPH: RunGraph = { nodes: [], view: { nodes: [], edges: [] } }

/**
 * The graph a run ran on as its map draws it: its graph view (`graphViewOfSpec`, every title in the reader's language, the trigger
 * card first) and each node with that title, the group it belongs to and where it goes next. The source is the snapshot of the
 * workflow version the run is pinned to (JSON text), else the flow of the agent graph; nothing while neither is read.
 */
export const runGraphOf = (source: unknown, locale: StepsLocale, nameOf: NodeNamer): RunGraph => {
    const spec = specOf(source)
    if (spec === null) return EMPTY_RUN_GRAPH
    const view = graphOfSpec(spec, locale)
    const titles = new Map(view.nodes.map((node) => [node.id, node.title ?? node.label]))
    return {
        view,
        nodes: spec.nodes.map((node) => ({
            key: node.key,
            title: titles.get(node.key) ?? nodeNameOf(node.key, nameOf),
            kind: "execute",
            shape: "rect",
            group: node.group ?? "",
            next: node.next === undefined ? [] : [node.next],
            routes: Object.entries(node.routes ?? {}).map(([label, target]) => ({ label, target })),
            bindings: { ...node.params, ...node.input },
        })),
    }
}

/**
 * The map a run is drawn on: the graph when it holds every node the run went through, else the path the run took, node by node, since
 * the run was opened on a version of the graph that is no longer the active one and its nodes are not all there.
 */
export const mapOfRun = (
    graph: ReadonlyArray<RunGraphNode>,
    steps: ReadonlyArray<AgentRunStepWire>,
    locale: StepsLocale,
    nameOf: NodeNamer,
): ReadonlyArray<RunGraphNode> => {
    const known = new Set(graph.map((node) => node.key))
    if (graph.length > 0 && steps.every((step) => known.has(step.nodeKey))) return graph
    return steps.map((step, index) => ({
        key: step.nodeKey,
        title:
            graph.find((node) => node.key === step.nodeKey)?.title ??
            nodeOfKey(step.nodeKey, locale)?.title ??
            nodeNameOf(step.nodeKey, nameOf),
        kind: "execute",
        shape: "rect",
        group: "",
        next: steps[index + 1] === undefined ? [] : [steps[index + 1]?.nodeKey ?? ""],
        routes: [],
        bindings: {},
    }))
}
