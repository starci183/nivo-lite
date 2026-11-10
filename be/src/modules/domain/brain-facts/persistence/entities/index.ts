import { BrainFactEntity } from "./brain-fact.entity"
import { BrainFactRelationEntity } from "./brain-fact-relation.entity"

export { BrainFactEntity, BrainFactRelationEntity }

/** The entities the Brain facts capability owns, for the app's connection. */
export const brainFactsEntities: readonly [typeof BrainFactEntity, typeof BrainFactRelationEntity] = [
    BrainFactEntity,
    BrainFactRelationEntity,
] as const
