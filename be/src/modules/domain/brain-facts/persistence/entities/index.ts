import { BrainFactEntity } from "./brain-fact.entity"

export { BrainFactEntity }

/** The entities the Brain facts capability owns, for the app's connection. */
export const brainFactsEntities: readonly [typeof BrainFactEntity] = [BrainFactEntity] as const
