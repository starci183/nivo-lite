import type { DailyWorkUsage } from "@modules/domain/ai-usage-events"
import type { GetCreditWorkUsageRequest } from "../../application/get-credit-work-usage.contracts"
import type { CreditWorkUsageInput } from "./dto/credit-work-usage.input"
import type { CreditWorkUsageType } from "./dto/credit-work-usage.type"

/** The days of the summary when the caller names none. */
const DEFAULT_DAYS = 30

/** Maps the workspace selector and the window to the request. */
export const toCreditWorkUsageRequest = (
    workspaceId: string,
    input: CreditWorkUsageInput,
): GetCreditWorkUsageRequest => ({
    workspaceId,
    days: input.days ?? DEFAULT_DAYS,
})

/** Maps the rows to their GraphQL type. */
export const toCreditWorkUsageType = (rows: ReadonlyArray<DailyWorkUsage>): Array<CreditWorkUsageType> =>
    rows.map((row) => ({ ...row }))
