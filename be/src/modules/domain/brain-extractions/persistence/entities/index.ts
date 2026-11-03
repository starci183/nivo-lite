import { BrainExtractionEntity } from "./brain-extraction.entity"

export { BrainExtractionEntity }

/** The entities the Brain extractions capability owns, for the app's connection. */
export const brainExtractionsEntities: readonly [typeof BrainExtractionEntity] = [BrainExtractionEntity] as const
