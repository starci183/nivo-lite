import { Module } from "@nestjs/common"
import { GetUsageSummaryHandler } from "./application/get-usage-summary.handler"

@Module({
    providers: [GetUsageSummaryHandler],
})
/** The usage feature: the handlers of its application. */
export class UsageApiModule {}
