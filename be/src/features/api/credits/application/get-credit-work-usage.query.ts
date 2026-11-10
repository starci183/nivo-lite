import { Query } from "@nestjs/cqrs"
import type { DailyWorkUsage } from "@modules/domain/ai-usage-events"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCreditWorkUsageRequest } from "./get-credit-work-usage.contracts"

/** Asks for the workspace's AI work per day, module and kind of work. */
export class GetCreditWorkUsageQuery extends Query<ReadonlyArray<DailyWorkUsage>> {
    constructor(readonly params: ExecuteParams<GetCreditWorkUsageRequest>) {
        super()
    }
}
