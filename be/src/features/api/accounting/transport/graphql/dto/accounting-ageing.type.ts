import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingMeasureType } from "./accounting-measure.type"

@ObjectType()
/** Accounting Ageing returned by GraphQL. */
export class AccountingAgeingType {
    /** d0. */
    @Field(() => AccountingMeasureType)
    d0!: AccountingMeasureType

    /** d30. */
    @Field(() => AccountingMeasureType)
    d30!: AccountingMeasureType

    /** d60. */
    @Field(() => AccountingMeasureType)
    d60!: AccountingMeasureType
}
