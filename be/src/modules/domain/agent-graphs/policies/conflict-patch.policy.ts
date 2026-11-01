import type { GraphBranch, GraphDocument, GraphNode, GraphSource } from "../agent-graphs.contracts"

/** What a confirmed Brain conflict moves: the rule a graph cited is replaced by the rule now in force. */
export interface ConflictPatch {
    /** The Brain fact the graph cited. */
    readonly oldFactId: string
    /** The Brain fact in force now. */
    readonly newFactId: string
    /** The hash of the value now in force, so a later change of it is found again. */
    readonly newValueHash: string
}

const swapped = (source: GraphSource, patch: ConflictPatch, passage: string): GraphSource =>
    source.kind === "brain" && source.factId === patch.oldFactId
        ? { kind: "brain", factId: patch.newFactId, passage, valueHash: patch.newValueHash }
        : source

const branchSwapped = (branch: GraphBranch, patch: ConflictPatch, passage: string): GraphBranch => ({
    ...branch,
    sources: branch.sources.map((source) => swapped(source, patch, passage)),
})

const nodeSwapped = (node: GraphNode, patch: ConflictPatch, passage: string): GraphNode => ({
    ...node,
    sources: node.sources.map((source) => swapped(source, patch, passage)),
    ...(node.decide === undefined
        ? {}
        : {
              decide: {
                  ...node.decide,
                  branches: node.decide.branches.map((branch) => branchSwapped(branch, patch, passage)),
              },
          }),
})

/** True when some node or branch of the graph cites the replaced fact. */
const cites = (document: GraphDocument, factId: string): boolean =>
    document.nodes.some((node) =>
        [...node.sources, ...(node.decide?.branches.flatMap((branch) => branch.sources) ?? [])].some(
            (source) => source.kind === "brain" && source.factId === factId,
        ),
    )

/**
 * The graph a confirmed conflict makes: every node and branch that cited the replaced Brain rule cites the rule in force now, with
 * its words. Only the rule behind the branch changes, never a boundary or a person: the owner moves those by hand, so a Brain
 * change alone never widens what the agent may do. Null when the graph no longer cites the replaced rule.
 */
export const applyConflict = (document: GraphDocument, patch: ConflictPatch, passage: string): GraphDocument | null =>
    cites(document, patch.oldFactId)
        ? { ...document, nodes: document.nodes.map((node) => nodeSwapped(node, patch, passage)) }
        : null
