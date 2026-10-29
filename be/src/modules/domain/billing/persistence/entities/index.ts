import { PlanEntity } from "./plan.entity"
import { PlanUsageTierEntity } from "./plan-usage-tier.entity"

export { PlanEntity, PlanUsageTierEntity }

/** Every entity the billing capability owns, collected by the database connection. */
export const billingEntities = [PlanEntity, PlanUsageTierEntity] as const
