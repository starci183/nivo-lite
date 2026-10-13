import type { Plan } from "@modules/domain/billing"
import type { BillingPlanType } from "./dto/billing-plan.type"

/** Maps the domain answer to the GraphQL contract. */
export const toBillingPlansType = (result: ReadonlyArray<Plan>): ReadonlyArray<BillingPlanType> => result
