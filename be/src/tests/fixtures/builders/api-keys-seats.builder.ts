import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The answer of the active-member read: a member of this role, or none. */
export const memberOf = (role: WorkspaceRole | undefined, displayName = "Owner"): SeatAnswer => ({
    seat: { role, displayName },
})

/** The seat the member read answers: a seat of this role, or none. */
export interface SeatFacts {
    readonly role: WorkspaceRole | undefined
    readonly displayName: string
}

/** The member read as a spec scenario declares it. */
export interface SeatAnswer {
    readonly seat: SeatFacts
}

/** True when an answer stands for the member read, not for a query builder. */
export const isSeatAnswer = (answer: QueryBuilderAnswers | SeatAnswer | undefined): answer is SeatAnswer =>
    answer !== undefined && "seat" in answer
