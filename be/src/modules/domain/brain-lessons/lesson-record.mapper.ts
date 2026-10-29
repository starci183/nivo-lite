import { isoOf } from "@modules/domain/brain-facts"
import type { LessonRecord } from "./brain-lessons.contracts"
import type { BrainLessonEntity } from "./persistence/entities"

/** A lesson as the callers read it, from the stored row. */
export const toLessonRecord = (row: BrainLessonEntity): LessonRecord => ({
    id: row.id,
    module: row.module,
    title: row.title,
    body: row.body,
    appliesWhen: row.appliesWhen,
    status: row.status,
    origin: row.origin,
    evidence: row.evidence,
    version: row.version,
    proposedBy: row.proposedBy,
    proposedAt: isoOf(row.proposedAt),
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt === null ? null : isoOf(row.decidedAt),
})
