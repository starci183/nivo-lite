import { Query } from "@nestjs/cqrs"
import type { UsageSummary } from "@modules/domain/usage"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetUsageSummaryRequest } from "./get-usage-summary.contracts"

/** Asks for this month's AI usage of the caller's workspace. */
export class GetUsageSummaryQuery extends Query<UsageSummary> {
    constructor(readonly params: ExecuteParams<GetUsageSummaryRequest>) {
        super()
    }
}
