import { ContentCadenceEntity } from "./content-cadence.entity"

export { ContentCadenceEntity }

/** The entities the content cadence capability owns, for the app's connection. */
export const contentCadenceEntities = [ContentCadenceEntity] as const
