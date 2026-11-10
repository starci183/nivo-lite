import { otherEnd } from "@modules/domain/brain-facts"
import type { ChangeFiled, FactRecord, FactRelation } from "@modules/domain/brain-facts"
import type { GatewayJson } from "@modules/domain/mcp-gateway"
import { factLineOf } from "./native-view.policy"

/**
 * The truths an edge joins to one truth, read from that truth (`out` when it starts there), each answered as a Brain line with its
 * version. An edge whose other end is not among the readable truths is left out with it.
 */
export const relatedLinesOf = (
    factId: string,
    edges: ReadonlyArray<FactRelation>,
    readable: ReadonlyMap<string, FactRecord>,
    limit: number,
): ReadonlyArray<GatewayJson> =>
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
                    fact: { ...factLineOf(other), version: other.version ?? null },
                },
            ]
        })
        .slice(0, limit)

/** What `brain.change.propose` answers: what happened and the change request, which waits for the founder while it is proposed. */
export const changeAnswerOf = (filed: ChangeFiled): GatewayJson => ({
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
