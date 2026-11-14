import { proposalRow } from "./agent-graph.builder"
import type { ProposalRecord } from "@modules/domain/agent-graphs"

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
