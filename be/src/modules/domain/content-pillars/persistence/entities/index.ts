import { ContentPillarEntity } from "./content-pillar.entity"

export { ContentPillarEntity }

/** The entities the content pillars capability owns, for the app's connection. */
export const contentPillarsEntities: readonly [typeof ContentPillarEntity] = [ContentPillarEntity] as const
