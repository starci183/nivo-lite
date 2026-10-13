import type { PlanQuote } from "@modules/domain/billing"
import type { BillingPlanQuoteRequest } from "../../application/billing-plan-quote.contracts"
import type { BillingPlanQuoteInput } from "./dto/billing-plan-quote.input"
import type { BillingPlanQuoteType } from "./dto/billing-plan-quote.type"

/** Maps the selected workspace and bounded GraphQL arguments to the query request. */
export const toBillingPlanQuoteRequest = (
    input: BillingPlanQuoteInput,
    workspaceId: string,
): BillingPlanQuoteRequest => ({
    workspaceId,
    planCode: input.planCode,
    selection: { cycle: input.cycle, tierCredits: input.tierCredits, seats: input.seats },
})

/** Maps the domain answer to the GraphQL contract. */
export const toBillingPlanQuoteType = (result: PlanQuote): BillingPlanQuoteType => ({ ...result })
