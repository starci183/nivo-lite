import { proposalRow } from "./agent-graph.builder"
import type { ProposalRecord } from "@modules/domain/agent-graphs"

type ClosedGraphDecisionsOfResultShape = {
    id: string
    branchKey: string
    closedAs: "approved"
    amount: number
}

/** A deterministic approval history whose evidence identities are stable across proposal examples. */
export const closedGraphDecisionsOf = (count: number, branchKey = "middle"): Array<ClosedGraphDecisionsOfResultShape> =>
    Array.from({ length: count }, (_unused, index) => ({
        id: `d${index}`,
        branchKey,
        closedAs: "approved" as const,
        amount: 6_000_000,
    }))

const CONFLICT = { oldFactId: "old", newFactId: "new", newValueHash: "hash" }

type GraphConflictCasesShape = {
    oldFactId: string
    newFactId: string
    newValueHash: string
}

/** Stored conflict patches with independent malformed identity fields and their expected public answers. */
export const GRAPH_CONFLICT_CASES: readonly [
    readonly [null, null],
    readonly [ProposalRecord, GraphConflictCasesShape],
    readonly [ProposalRecord, null],
    readonly [ProposalRecord, null],
    readonly [ProposalRecord, null],
] = [
    [null, null],
    [proposalRow({ kind: "conflict", patch: CONFLICT }), CONFLICT],
    [proposalRow({ kind: "conflict", patch: { ...CONFLICT, oldFactId: 1 } }), null],
    [proposalRow({ kind: "conflict", patch: { ...CONFLICT, newFactId: 1 } }), null],
    [proposalRow({ kind: "conflict", patch: { ...CONFLICT, newValueHash: 1 } }), null],
] as const
