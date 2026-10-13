import { Module } from "@nestjs/common"
import { ListCreditPacksHandler } from "./application/list-credit-packs.handler"
import { ListCreditPacksBoughtHandler } from "./application/list-credit-packs-bought.handler"
import { ListCreditTopupLotsHandler } from "./application/list-credit-topup-lots.handler"
import { GetCreditQuotaStatusHandler } from "./application/get-credit-quota-status.handler"
import { GetCreditUsageSummaryHandler } from "./application/get-credit-usage-summary.handler"
import { GetCreditRecentCostUsdHandler } from "./application/get-credit-recent-cost-usd.handler"

@Module({
    providers: [
        ListCreditPacksHandler,
        ListCreditPacksBoughtHandler,
        ListCreditTopupLotsHandler,
        GetCreditQuotaStatusHandler,
        GetCreditUsageSummaryHandler,
        GetCreditRecentCostUsdHandler,
    ],
})
/** The credit catalogue, purchased lots, quota and usage application handlers. */
export class CreditsApiModule {}
