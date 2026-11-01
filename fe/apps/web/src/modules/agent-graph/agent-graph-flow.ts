import type {
    AgentGraphBranchHit,
    AgentGraphCanvasView,
    AgentGraphNodeKind,
    AgentGraphFlowNode,
    AgentGraphNodeData,
    AgentGraphPaint,
} from "@/modules/types"

/** The kinds of node in the order a flow goes: what starts it, what it works out, what it decides, what it does. */
export const BANDS: ReadonlyArray<AgentGraphNodeKind> = ["trigger", "execute", "condition", "output"]

/** Whether the paint marks a node: the selected one, or any node on the path of a traced run. */
const isMarked = (key: string, paint: AgentGraphPaint): boolean => key === paint.selectedKey || paint.path.includes(key)

/**
 * The nodes as the graph draws them: the graph lays them out top to bottom, each step below the ones that lead to it. A selected or
 * visited node paints `accent`, and while a run is traced every other node is dimmed and paints `muted`.
 */
export const flowNodesOf = (
    nodes: ReadonlyArray<AgentGraphNodeData>,
    paint: AgentGraphPaint,
): ReadonlyArray<AgentGraphFlowNode> =>
    nodes.map((node) => {
        const isTraced = paint.path.length > 0
        const tone = (() => {
            if (isMarked(node.key, paint)) return "accent"
            return isTraced ? "muted" : node.card.tone
        })()
        return {
            id: node.key,
            label: node.title,
            description: node.card.description,
            kind: node.kind,
            tone,
            shape: node.card.shape,
            count: node.card.count,
            isPlaceholder: node.card.isPlaceholder,
            isDimmed: isTraced && !isMarked(node.key, paint),
        }
    })

/** The words an edge may carry and whether a traced run went along it. */
export interface AgentGraphEdgeWords {
    readonly approved: string
    readonly taken: (label: string) => string
    readonly isTaken: (source: string, target: string) => boolean
}

/** The edges: each branch of a decide node reads its condition, what a person approved reads `approved`, and the branch a traced run took is marked. */
export const flowEdgesOf = (
    nodes: ReadonlyArray<AgentGraphNodeData>,
    words: AgentGraphEdgeWords,
): AgentGraphCanvasView["edges"] =>
    nodes.flatMap((node) => {
        if (node.branches.length > 0) {
            return node.branches.map((branch) => ({
                id: `${node.key}:${branch.key}`,
                source: node.key,
                target: branch.next,
                label: words.isTaken(node.key, branch.next) ? words.taken(branch.when) : branch.when,
            }))
        }
        return node.next.map((target) => ({
            id: `${node.key}:${target}`,
            source: node.key,
            target,
            ...(node.approver !== null ? { label: words.approved } : {}),
        }))
    })

/** The branch a node is the answer of, with the decide node that asks; null for a node no branch leads to. */
export const branchHitOf = (nodes: ReadonlyArray<AgentGraphNodeData>, nodeKey: string): AgentGraphBranchHit | null => {
    for (const parent of nodes) {
        const position = parent.branches.findIndex((branch) => branch.next === nodeKey)
        const branch = parent.branches[position]
        if (branch !== undefined) return { parent, branch, position }
    }
    return null
}

/** Every branch of the graph in the order it is read, for the phone list: the node it asks from and the node it goes to. */
export const branchHitsOf = (nodes: ReadonlyArray<AgentGraphNodeData>): ReadonlyArray<AgentGraphBranchHit> =>
    nodes.flatMap((parent) => parent.branches.map((branch, position) => ({ parent, branch, position })))

/**
 * The layer each node sits in when the graph lays them out top to bottom: after the deepest step that leads to it, so a step that
 * waits for two others sits below both. An edge that closes a cycle is ignored, as the graph ignores it.
 */
const layersOf = (nodes: ReadonlyArray<AgentGraphNodeData>): ReadonlyMap<string, number> => {
    const layers = new Map(nodes.map((node) => [node.key, 0]))
    const edges = nodes.flatMap((node) =>
        (node.branches.length > 0 ? node.branches.map((branch) => branch.next) : node.next).map((target) => ({
            source: node.key,
            target,
        })),
    )
    for (let pass = 0; pass < nodes.length; pass += 1) {
        for (const edge of edges) {
            const from = layers.get(edge.source)
            const to = layers.get(edge.target)
            if (from !== undefined && to !== undefined && to <= from && from < nodes.length)
                layers.set(edge.target, from + 1)
        }
    }
    return layers
}

/** The title of each lane of the map: the kind of step a layer holds, for each layer whose steps are all of one kind. */
export const layerHeadersOf = (
    nodes: ReadonlyArray<AgentGraphNodeData>,
    word: (kind: AgentGraphNodeKind) => string,
): ReadonlyArray<{ readonly label: string; readonly at: number }> => {
    const layers = layersOf(nodes)
    const at = [...new Set(layers.values())].sort((left, right) => left - right)
    return at.flatMap((layer, index) => {
        const kinds = new Set(nodes.filter((node) => layers.get(node.key) === layer).map((node) => node.kind))
        const [kind] = [...kinds]
        const before = nodes.find((node) => layers.get(node.key) === at[index - 1])?.kind
        // A lane that holds the same kind as the one above it is the same lane: its title is written once.
        return kinds.size === 1 && kind !== undefined && kind !== before ? [{ label: word(kind), at: layer }] : []
    })
}
