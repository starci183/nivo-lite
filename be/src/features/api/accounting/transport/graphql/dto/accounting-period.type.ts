import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingMeasureType } from "./accounting-measure.type"
import { AccountingWeekType } from "./accounting-week.type"

@ObjectType()
/** Accounting Period returned by GraphQL. */
export class AccountingPeriodType {
    /** key. */
    @Field(() => String)
    key!: string

    /** from Iso. */
    @Field(() => String)
    fromIso!: string

    /** to Iso. */
    @Field(() => String)
    toIso!: string

    /** income. */
    @Field(() => AccountingMeasureType)
    income!: AccountingMeasureType

    /** receivable. */
    @Field(() => AccountingMeasureType)
    receivable!: AccountingMeasureType

    /** unmatched. */
    @Field(() => AccountingMeasureType)
    unmatched!: AccountingMeasureType

    /** weeks. */
    @Field(() => [AccountingWeekType])
    weeks!: ReadonlyArray<AccountingWeekType>
}
