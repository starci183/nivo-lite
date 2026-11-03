import { DecisionEntity } from "./decision.entity"

export { DecisionEntity }

/** The entities the decisions capability owns, for the app's connection. */
export const decisionsEntities: readonly [typeof DecisionEntity] = [DecisionEntity] as const
