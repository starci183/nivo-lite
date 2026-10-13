import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingSplitType } from "./accounting-split.type"

@ObjectType()
/** Accounting Measure returned by GraphQL. */
export class AccountingMeasureType {
    /** vnd. */
    @Field(() => AccountingSplitType)
    vnd!: AccountingSplitType

    /** count. */
    @Field(() => AccountingSplitType)
    count!: AccountingSplitType
}
