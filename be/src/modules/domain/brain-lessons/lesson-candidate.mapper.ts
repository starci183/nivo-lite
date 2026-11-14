import { isoOf } from "@modules/domain/brain-facts"
import type { LessonCandidate } from "./lesson-candidates.contracts"
import type { BrainLessonCandidateEntity } from "./persistence/entities"

/** A lesson candidate as the callers read it, from the stored row. */
export const toLessonCandidate = (row: BrainLessonCandidateEntity): LessonCandidate => ({
    id: row.id,
    stopId: row.stopId,
    runId: row.runId,
    agentId: row.agentId,
    workflowId: row.workflowId,
    stepKey: row.stepKey,
    question: row.question,
    answer: row.answer,
    answeredBy: row.answeredBy,
    answeredAt: isoOf(row.answeredAt),
    thenDid: row.thenDid,
    general: row.general,
    groupId: row.groupId,
    status: row.status,
    changeId: row.changeId,
    factKey: row.factKey,
    factId: row.factId,
})
