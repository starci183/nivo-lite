import { Command } from "@nestjs/cqrs"
import type { MarketingWeeklyReport } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PostMarketingReportRequest } from "./post-marketing-report.contracts"

/** Syncs insights and posts the weekly report card. */
export class PostMarketingReportCommand extends Command<MarketingWeeklyReport> {
    constructor(readonly params: ExecuteParams<PostMarketingReportRequest>) {
        super()
    }
}
