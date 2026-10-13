import { Field, ObjectType } from "@nestjs/graphql"
import { CreditDailyUsageType } from "./credit-daily-usage.type"
import { CreditModuleUsageType } from "./credit-module-usage.type"
import { CreditQuotaStatusType } from "./credit-quota-status.type"

@ObjectType()
/** The monthly quota, module split and daily usage chart. */
export class CreditUsageSummaryType {
    /** The workspace quota, when one is present. */
    @Field(() => CreditQuotaStatusType, { nullable: true })
    status!: CreditQuotaStatusType | null

    /** Modules ordered by credits consumed. */
    @Field(() => [CreditModuleUsageType])
    byModule!: Array<CreditModuleUsageType>

    /** Days in chronological order. */
    @Field(() => [CreditDailyUsageType])
    daily!: Array<CreditDailyUsageType>
}
