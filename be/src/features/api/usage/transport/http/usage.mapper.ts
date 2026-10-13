import type { UsageSummary } from "@modules/domain/usage"
import type { UsageSummaryResponse } from "./dto/usage-summary.response"

/** Maps the usage summary to the HTTP response (the same shape). */
export const toUsageSummaryResponse = (result: UsageSummary): UsageSummaryResponse => result
