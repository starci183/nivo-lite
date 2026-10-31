import type { GraphDocument, GraphSource } from "../agent-graphs.contracts"

/** One row of the index of sources: which rule backs which node or branch of a version. */
export interface SourceRow {
    /** The node key. */
    readonly nodeKey: string
    /** The branch, or an empty text for the node itself. */
    readonly branchKey: string
    /** The kind. */
    readonly kind: GraphSource["kind"]
    /** The ref. */
    readonly ref: string
    /** The hash of the value the rule held when the owner confirmed it; empty for a source that has none. */
    readonly valueHash: string
}

/** What names a source in the index: a fact id, a template key, a message id, a proposal id, a member id, an action key. */
const refOf = (source: GraphSource): string => {
    switch (source.kind) {
        case "brain":
            return source.factId
        case "template":
            return source.key
        case "chat":
            return source.messageId
        case "learned":
            return source.proposalId
        case "owner":
            return source.memberId
        case "rule":
            return source.action
    }
}

const rowOf = (nodeKey: string, branchKey: string, source: GraphSource): SourceRow => ({
    nodeKey,
    branchKey,
    kind: source.kind,
    ref: refOf(source),
    valueHash: source.kind === "brain" ? source.valueHash : "",
})

/** Every source of every node and branch of a graph, once each, so a changed Brain fact is found without opening every version. */
export const sourcesIndexOf = (graph: GraphDocument): ReadonlyArray<SourceRow> => {
    const rows = graph.nodes.flatMap((node) => [
        ...node.sources.map((source) => rowOf(node.key, "", source)),
        ...(node.decide?.branches ?? []).flatMap((branch) =>
            branch.sources.map((source) => rowOf(node.key, branch.key, source)),
        ),
    ])
    return rows.filter(
        (row, index) =>
            rows.findIndex(
                (other) =>
                    other.nodeKey === row.nodeKey &&
                    other.branchKey === row.branchKey &&
                    other.kind === row.kind &&
                    other.ref === row.ref,
            ) === index,
    )
}
