import type { BrainOverview } from "@modules/domain/brain"
import type { BrainType } from "./dto/brain.type"
import { toBrainFactType } from "./brain-fact.mapper"
import { toBrainLessonType } from "./brain-lesson.mapper"
import { toExtractionType, toGapType, toLensType } from "./brain-parts.mapper"

/** Maps everything the Second Brain page shows to the GraphQL type. */
export const toBrainType = (brain: BrainOverview): BrainType => ({
    facts: brain.facts.map((item) => toBrainFactType(item)),
    factsTotal: brain.factsTotal,
    factsNextCursor: brain.factsNextCursor,
    lessons: brain.lessons.map((item) => toBrainLessonType(item)),
    gaps: brain.gaps.map((item) => toGapType(item)),
    gapsOpen: brain.gapsOpen,
    extractions: brain.extractions.map((item) => toExtractionType(item)),
    lenses: brain.lenses.map((item) => toLensType(item)),
})
