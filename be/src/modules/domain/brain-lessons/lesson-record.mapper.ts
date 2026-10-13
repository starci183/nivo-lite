import { isoOf } from "@modules/domain/brain-facts"
import type { LessonRecord } from "./brain-lessons.contracts"
import type { BrainLessonRow } from "./persistence/brain-lessons.rows"

/** A lesson as the callers read it, from the row the database answers. */
export const toLessonRecord = (row: BrainLessonRow): LessonRecord => ({
    id: row.id,
    module: row.module,
    title: row.title,
    body: row.body,
    appliesWhen: row.applies_when,
    status: row.status,
    origin: row.origin,
    evidence: row.evidence ?? [],
    version: row.version,
    proposedBy: row.proposed_by,
    proposedAt: isoOf(row.proposed_at),
    decidedBy: row.decided_by,
    decidedAt: row.decided_at === null ? null : isoOf(row.decided_at),
})
