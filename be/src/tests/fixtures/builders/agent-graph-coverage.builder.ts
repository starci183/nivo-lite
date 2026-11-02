import { proposalRow } from "./agent-graph.builder"
import type { QueryBuilderAnswers } from "./entity-query-builder-fake.builder"

/** A deterministic approval history whose evidence identities are stable across proposal examples. */
export const closedGraphDecisionsOf = (count: number, branchKey = "middle") =>
    Array.from({ length: count }, (_unused, index) => ({
        id: `d${index}`,
        branchKey,
        closedAs: "approved" as const,
        amount: 6_000_000,
    }))

/** The exact query-builder receipt of a first or duplicate proposal insertion. */
export const graphProposalInserted = (written: boolean): QueryBuilderAnswers => ({
    execute: { identifiers: written ? [{ id: "p1" }] : [], raw: [] },
})

const CONFLICT = { oldFactId: "old", newFactId: "new", newValueHash: "hash" }

/** Stored conflict patches with independent malformed identity fields and their expected public answers. */
export const GRAPH_CONFLICT_CASES = [
    [null, null],
    [proposalRow({ patch: CONFLICT }), CONFLICT],
    [proposalRow({ patch: { ...CONFLICT, oldFactId: 1 } }), null],
    [proposalRow({ patch: { ...CONFLICT, newFactId: 1 } }), null],
    [proposalRow({ patch: { ...CONFLICT, newValueHash: 1 } }), null],
] as const
