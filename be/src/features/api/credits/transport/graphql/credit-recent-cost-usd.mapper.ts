import type { GetCreditRecentCostUsdRequest } from "../../application/get-credit-recent-cost-usd.contracts"
import type { CreditRecentCostInput } from "./dto/credit-recent-cost.input"

/** Maps the workspace selector and bounded date to the request. */
export const toCreditRecentCostUsdRequest = (
    workspaceId: string,
    input: CreditRecentCostInput,
): GetCreditRecentCostUsdRequest => ({
    workspaceId,
    from: input.from,
})

/** Maps the model cost to its GraphQL scalar. */
export const toCreditRecentCostUsdType = (result: number): number => result
