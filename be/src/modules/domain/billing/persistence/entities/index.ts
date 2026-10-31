import { BillingConfigEntity } from "./billing-config.entity"
import { BillingEventEntity } from "./billing-event.entity"
import { PlanEntity } from "./plan.entity"
import { PlanUsageTierEntity } from "./plan-usage-tier.entity"

export { BillingConfigEntity, BillingEventEntity, PlanEntity, PlanUsageTierEntity }

/** Every entity the billing capability owns, collected by the database connection. */
export const billingEntities = [BillingEventEntity, PlanEntity, PlanUsageTierEntity, BillingConfigEntity] as const
