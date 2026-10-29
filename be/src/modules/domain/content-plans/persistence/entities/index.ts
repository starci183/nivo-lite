import { ContentPlanEntity } from "./content-plan.entity"

export { ContentPlanEntity }

/** The entities the content plans capability owns, for the app's connection. */
export const contentPlansEntities = [ContentPlanEntity] as const
