import { otherEnd, type ChangeFiled, type FactRelation } from "@modules/domain/brain-facts"
import type { ToolJson } from "@modules/domain/tools"
import type { ServedLine } from "./native-view.policy"

/**
 * The truths an edge joins to one truth, read from that truth (`out` when it starts there), each answered as the Brain line it is
 * served as (`servedLineOf`: version, source, validity included). An edge whose other end is not among the readable truths is left out
 * with it.
 */
export const relatedLinesOf = (
    factId: string,
    edges: ReadonlyArray<FactRelation>,
    readable: ReadonlyMap<string, ServedLine>,
    limit: number,
): ReadonlyArray<ToolJson> =>
    edges
        .flatMap((edge) => {
            const id = otherEnd(edge, factId)
            const other = id === null ? undefined : readable.get(id)
            if (other === undefined) return []
            return [
                {
                    relation: edge.kind,
                    direction: edge.fromFactId === factId ? "out" : "in",
                    label: edge.label,
                    fact: { ...other },
                },
            ]
        })
        .slice(0, limit)

/** What `nivo.tool.brain.change.propose` answers: what happened and the change request, which waits for the founder while it is proposed. */
export const changeAnswerOf = (filed: ChangeFiled): ToolJson => ({
    outcome: filed.outcome,
    changeRequest: {
        id: filed.fact.id,
        status: filed.fact.status,
        subject: filed.fact.subjectLabel,
        attribute: filed.fact.attributeLabel,
        value: filed.fact.value,
        kind: filed.fact.proposalKind,
        waitsFor: filed.fact.status === "proposed" ? "founder" : null,
    },
})
