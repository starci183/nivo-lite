import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingPeriodType } from "./accounting-period.type"

@ObjectType()
/** Accounting Periods returned by GraphQL. */
export class AccountingPeriodsType {
    /** this. */
    @Field(() => AccountingPeriodType)
    this!: AccountingPeriodType

    /** last. */
    @Field(() => AccountingPeriodType)
    last!: AccountingPeriodType
}
