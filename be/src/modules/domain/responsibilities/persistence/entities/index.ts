import { ResponsibilityEntity } from "./responsibility.entity"

export { ResponsibilityEntity }

/** The entities of the responsibilities capability, registered on the primary connection. */
export const responsibilitiesEntities: readonly [typeof ResponsibilityEntity] = [ResponsibilityEntity] as const
