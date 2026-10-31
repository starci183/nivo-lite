import type {
    AgentGraphBranchHit,
    AgentGraphNodeKind,
    AgentGraphFlowEdge,
    AgentGraphFlowNode,
    AgentGraphNodeData,
    AgentGraphPaint,
} from "@/modules/types"

/** The bands from left to right, and the width and row height of the grid the cards sit on, in graph units. */
export const BANDS: ReadonlyArray<AgentGraphNodeKind> = ["trigger", "execute", "condition", "output"]
const BAND_WIDTH = 360
const ROW_HEIGHT = 110

/** The centre of the column of a band, where its header is drawn. */
export const bandCentreOf = (kind: AgentGraphNodeKind): number => BANDS.indexOf(kind) * BAND_WIDTH

/** Where a card sits: its band is the column, and its order among the cards of its band the row. */
const positionOf = (
    nodes: ReadonlyArray<AgentGraphNodeData>,
    node: AgentGraphNodeData,
): AgentGraphFlowNode["position"] => ({
    x: bandCentreOf(node.kind),
    y: nodes.filter((entry) => entry.kind === node.kind).indexOf(node) * ROW_HEIGHT,
})

/** Whether the paint marks a node: the selected one, or any node on the path of a traced run. */
const isMarked = (key: string, paint: AgentGraphPaint): boolean => key === paint.selectedKey || paint.path.includes(key)

/**
 * The nodes as the graph draws them, laid out left to right in three bands. The installed grammar has no dimming and no outline on a selected card, so a selected or
 * visited node paints `accent`, and while a run is traced every other node paints `muted`.
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
            tone,
            shape: node.card.shape,
            count: node.card.count,
            isPlaceholder: node.card.isPlaceholder,
            position: positionOf(nodes, node),
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
): ReadonlyArray<AgentGraphFlowEdge> =>
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
