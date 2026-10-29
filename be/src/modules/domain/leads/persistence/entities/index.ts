import { LeadEntity } from "./lead.entity"

export { LeadEntity }
export type { LeadStage } from "./lead.entity"

/** The entities the leads capability owns, collected by the database module. */
export const leadsEntities = [LeadEntity] as const
