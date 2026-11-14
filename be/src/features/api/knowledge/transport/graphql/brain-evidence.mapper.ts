import type { Evidence } from "@modules/domain/brain-facts"
import type { LessonEvidence } from "@modules/domain/brain-lessons"
import type { BrainEvidenceType } from "./dto/brain-evidence.type"

/** Maps a piece of evidence of a fact to the GraphQL type. */
export const toFactEvidenceType = (item: Evidence): BrainEvidenceType => ({
    kind: item.kind,
    ref: item.ref,
    label: item.label,
    quote: item.quote,
    at: item.at,
    sourceTitle: item.title,
    sourceId: item.sourceId,
})

/** Maps a piece of evidence of a lesson to the GraphQL type. */
export const toLessonEvidenceType = (item: LessonEvidence): BrainEvidenceType => ({
    kind: item.kind,
    ref: item.ref,
    label: item.label,
    at: item.at,
})
