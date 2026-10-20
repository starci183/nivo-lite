import { Query } from "@nestjs/cqrs"
import type { MarketingWeeklyReport } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetMarketingReportRequest } from "./get-marketing-report.contracts"

/** Reads the weekly marketing report. */
export class GetMarketingReportQuery extends Query<MarketingWeeklyReport> {
    constructor(readonly params: ExecuteParams<GetMarketingReportRequest>) {
        super()
    }
}
