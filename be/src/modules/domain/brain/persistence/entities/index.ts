import { BrainSourceProfileEntity } from "./brain-source-profile.entity"

export { BrainSourceProfileEntity }

/** Every entity the brain capability owns, collected by the database connection. */
export const brainEntities = [BrainSourceProfileEntity] as const
