import { LeadActionEntity } from "./lead-action.entity"

export { LeadActionEntity }

/** The entities the lead actions capability owns, for the app's connection. */
export const leadActionsEntities: readonly [typeof LeadActionEntity] = [LeadActionEntity] as const
