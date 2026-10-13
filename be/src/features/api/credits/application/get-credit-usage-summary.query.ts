import { Query } from "@nestjs/cqrs"
import type { UsageSummary } from "@modules/domain/ai-usage-events"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCreditUsageSummaryRequest } from "./get-credit-usage-summary.contracts"

/** Asks for get credit usage summary. */
export class GetCreditUsageSummaryQuery extends Query<UsageSummary> {
    constructor(readonly params: ExecuteParams<GetCreditUsageSummaryRequest>) {
        super()
    }
}
