import type { Plan } from "@modules/domain/billing"
import type { BillingPlanRequest } from "../../application/billing-plan.contracts"
import type { BillingPlanType } from "./dto/billing-plan.type"
import type { BillingPlanInput } from "./dto/billing-plan.input"

/** Maps the GraphQL selector to the query request. */
export const toBillingPlanRequest = (input: BillingPlanInput): BillingPlanRequest => ({ code: input.code })

/** Maps the domain answer to the GraphQL contract. */
export const toBillingPlanType = (result: Plan | null): BillingPlanType | null => result
