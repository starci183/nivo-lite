import type { BrainOverview } from "@modules/domain/brain"
import type { BrainType } from "./dto/brain.type"
import { toBrainFactType, toBrainLessonType, toExtractionType, toGapType, toLensType } from "./brain-items.mapper"

/** Maps everything the Second Brain page shows to the GraphQL type. */
export const toBrainType = (brain: BrainOverview): BrainType => ({
    facts: brain.facts.map((fact) => toBrainFactType(fact)),
    lessons: brain.lessons.map((lesson) => toBrainLessonType(lesson)),
    gaps: brain.gaps.map((gap) => toGapType(gap)),
    gapsOpen: brain.gapsOpen,
    extractions: brain.extractions.map((extraction) => toExtractionType(extraction)),
    lenses: brain.lenses.map((lens) => toLensType(lens)),
})
