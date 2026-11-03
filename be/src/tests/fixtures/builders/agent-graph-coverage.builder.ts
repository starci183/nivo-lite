import { proposalRow } from "./agent-graph.builder"
import type { QueryBuilderAnswers } from "./entity-query-builder-fake.builder"

type AgentGraphProposalEntity = ReturnType<typeof proposalRow>

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

/** The exact query-builder receipt of a first or duplicate proposal insertion. */
export const graphProposalInserted = (written: boolean): QueryBuilderAnswers => ({
    execute: { identifiers: written ? [{ id: "p1" }] : [], raw: [] },
})

const CONFLICT = { oldFactId: "old", newFactId: "new", newValueHash: "hash" }

type GraphConflictCasesShape = {
    oldFactId: string
    newFactId: string
    newValueHash: string
}

/** Stored conflict patches with independent malformed identity fields and their expected public answers. */
export const GRAPH_CONFLICT_CASES: readonly [
    readonly [null, null],
    readonly [AgentGraphProposalEntity, GraphConflictCasesShape],
    readonly [AgentGraphProposalEntity, null],
    readonly [AgentGraphProposalEntity, null],
    readonly [AgentGraphProposalEntity, null],
] = [
    [null, null],
    [proposalRow({ patch: CONFLICT }), CONFLICT],
    [proposalRow({ patch: { ...CONFLICT, oldFactId: 1 } }), null],
    [proposalRow({ patch: { ...CONFLICT, newFactId: 1 } }), null],
    [proposalRow({ patch: { ...CONFLICT, newValueHash: 1 } }), null],
] as const
