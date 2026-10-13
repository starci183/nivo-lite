import type { UsageSummary } from "@modules/domain/ai-usage-events"
import type { GetCreditUsageSummaryRequest } from "../../application/get-credit-usage-summary.contracts"
import { toCreditQuotaStatusType } from "./credit-quota-status.mapper"
import type { CreditUsageSummaryType } from "./dto/credit-usage-summary.type"

/** Maps the workspace selector to the application request. */
export const toCreditUsageSummaryRequest = (workspaceId: string): GetCreditUsageSummaryRequest => ({ workspaceId })

/** Maps the quota, module split and daily series to GraphQL types. */
export const toCreditUsageSummaryType = (result: UsageSummary): CreditUsageSummaryType => ({
    status: toCreditQuotaStatusType(result.status),
    byModule: result.byModule.map((usage) => ({ ...usage })),
    daily: result.daily.map((usage) => ({ ...usage })),
})
