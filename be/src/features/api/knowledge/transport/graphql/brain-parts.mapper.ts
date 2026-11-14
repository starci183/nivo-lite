import type { BrainLens } from "@modules/domain/brain"
import type { ExtractionState } from "@modules/domain/brain-extractions"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { BrainExtractionType } from "./dto/brain-extraction.type"
import type { BrainGapType } from "./dto/brain-gap.type"
import type { BrainLensType } from "./dto/brain-lens.type"

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
