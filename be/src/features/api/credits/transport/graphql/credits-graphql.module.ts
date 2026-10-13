import { Module } from "@nestjs/common"
import { CreditsApiModule } from "../../credits.module"
import { CreditPacksBoughtResolver } from "./credit-packs-bought.resolver"
import { CreditPacksResolver } from "./credit-packs.resolver"
import { CreditQuotaStatusResolver } from "./credit-quota-status.resolver"
import { CreditRecentCostUsdResolver } from "./credit-recent-cost-usd.resolver"
import { CreditTopupLotsResolver } from "./credit-topup-lots.resolver"
import { CreditUsageSummaryResolver } from "./credit-usage-summary.resolver"

@Module({
    imports: [CreditsApiModule],
    providers: [
        CreditPacksResolver,
        CreditPacksBoughtResolver,
        CreditTopupLotsResolver,
        CreditQuotaStatusResolver,
        CreditUsageSummaryResolver,
        CreditRecentCostUsdResolver,
    ],
})
/** The GraphQL transport of the credit catalogue and workspace usage. */
export class CreditsGraphqlModule {}
