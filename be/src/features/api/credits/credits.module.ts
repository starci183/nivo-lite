import { Module } from "@nestjs/common"
import { BuyCreditPackHandler } from "./application/buy-credit-pack.handler"
import { GetCreditsOverviewHandler } from "./application/get-credits-overview.handler"
import { UpgradePlanHandler } from "./application/upgrade-plan.handler"

@Module({
    providers: [BuyCreditPackHandler, GetCreditsOverviewHandler, UpgradePlanHandler],
})
/** The credits feature: the handlers of its application. */
export class CreditsApiModule {}
