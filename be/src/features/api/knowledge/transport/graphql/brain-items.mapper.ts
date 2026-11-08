import type { BrainLens } from "@modules/domain/brain"
import type { ExtractionState } from "@modules/domain/brain-extractions"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { BrainExtractionType } from "./dto/brain-extraction.type"
import type { BrainFactType } from "./dto/brain-fact.type"
import type { BrainGapType } from "./dto/brain-gap.type"
import type { BrainLensType } from "./dto/brain-lens.type"
import type { BrainLessonType } from "./dto/brain-lesson.type"

/** Maps a fact to the GraphQL type. */
export const toBrainFactType = (fact: FactRecord): BrainFactType => ({
    id: fact.id,
    subjectType: fact.subjectType,
    subjectKey: fact.subjectKey,
    subjectLabel: fact.subjectLabel,
    attribute: fact.attribute,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    scope: fact.scope,
    modules: [...fact.modules],
    installationId: fact.installationId,
    status: fact.status,
    sourceKind: fact.sourceKind,
    trust: fact.trust,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    proposalKind: fact.proposalKind,
    evidence: fact.evidence.map((item) => ({
        kind: item.kind,
        ref: item.ref,
        label: item.label,
        quote: item.quote,
        at: item.at,
        sourceTitle: item.title,
        sourceId: item.sourceId,
    })),
    proposedBy: fact.proposedBy,
    proposedAt: fact.proposedAt,
    decidedBy: fact.decidedBy,
    decidedAt: fact.decidedAt,
    decisionNote: fact.decisionNote,
})

/** Maps a lesson to the GraphQL type. */
export const toBrainLessonType = (lesson: LessonRecord): BrainLessonType => ({
    id: lesson.id,
    module: lesson.module,
    title: lesson.title,
    body: lesson.body,
    appliesWhen: lesson.appliesWhen,
    status: lesson.status,
    evidence: lesson.evidence.map((item) => ({
        kind: item.kind,
        ref: item.ref,
        label: item.label,
        at: item.at,
    })),
})

/** Maps an unanswered customer question to the GraphQL type. */
export const toGapType = (gap: GapRecord): BrainGapType => ({
    id: gap.id,
    module: gap.module,
    question: gap.question,
    topic: gap.topic,
    attributeGuess: gap.attributeGuess,
    count: gap.count,
    lastSeenAt: gap.lastSeenAt,
    reopenedCount: gap.reopenedCount,
})

/** Maps the reading of a document to the GraphQL type. */
export const toExtractionType = (extraction: ExtractionState): BrainExtractionType => ({
    sourceId: extraction.sourceId,
    status: extraction.status,
})

/** Maps an agent lens to the GraphQL type. */
export const toLensType = (lens: BrainLens): BrainLensType => ({ ...lens })
